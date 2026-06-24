/**
 * =============================================================================
 *  CHITKARA FULL STACK ENGINEERING CHALLENGE — BACKEND
 *  server.js
 *
 *  Author  : Tarangit Chhabra
 *  Roll No : 2310990904
 *  Email   : tarangit0904.b23@chitkara.edu.in
 * =============================================================================
 */

const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5000;

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(cors());            // Allow cross-origin requests (front-end dev server)
app.use(express.json());   // Parse incoming JSON bodies
app.use(express.static(path.join(__dirname, "public")));

// ===========================================================================
// HELPER — VALIDATION
// ===========================================================================

/**
 * isValidEdge(str)
 *
 * An edge string is valid if and only if it strictly matches:
 *   "X->Y"  — where X and Y are EACH a single UPPERCASE letter (A-Z)
 *             AND X !== Y  (no self-loops like "A->A")
 *
 * Regex breakdown:
 *   ^        — start of string
 *   ([A-Z])  — exactly ONE uppercase letter (capture group = parent)
 *   ->       — literal arrow separator
 *   ([A-Z])  — exactly ONE uppercase letter (capture group = child)
 *   $        — end of string
 *
 * We also explicitly forbid self-loops (parent === child).
 */
function parseEdge(trimmed) {
  const EDGE_REGEX = /^([A-Z])->([A-Z])$/;
  const match = trimmed.match(EDGE_REGEX);

  if (!match) return null;                  // Format mismatch → invalid
  const [, parent, child] = match;
  if (parent === child) return null;        // Self-loop → invalid

  return { parent, child };
}

// ===========================================================================
// HELPER — CYCLE DETECTION  (Iterative DFS with 3-color marking)
// ===========================================================================

/**
 * hasCycle(adj, nodes)
 *
 * Classic directed-graph cycle detection using DFS with three states:
 *
 *   WHITE (0) — node not yet visited
 *   GRAY  (1) — node is in the current DFS recursion stack
 *   BLACK (2) — node fully processed (all descendants explored)
 *
 * Algorithm:
 *   For each unvisited node, push it onto an explicit stack.
 *   When we enter a node we color it GRAY.
 *   When we leave a node (all children processed) we color it BLACK.
 *   If we ever try to visit a GRAY node we have found a back-edge → CYCLE.
 *
 * Returns true if any cycle exists in the directed graph, false otherwise.
 *
 * @param {Map<string, string[]>} adj  — adjacency list  (node → [children])
 * @param {Set<string>}          nodes — all nodes in this connected component
 */
function hasCycle(adj, nodes) {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = {};
  for (const n of nodes) color[n] = WHITE;

  // Iterative DFS (avoids call-stack overflow on very large inputs)
  for (const start of nodes) {
    if (color[start] !== WHITE) continue;

    // Stack items: { node, childIndex }
    // childIndex tracks which child we should visit next (resume point)
    const stack = [{ node: start, childIdx: 0 }];
    color[start] = GRAY;

    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const { node } = frame;
      const children = adj.get(node) || [];

      if (frame.childIdx < children.length) {
        const child = children[frame.childIdx++];

        if (color[child] === GRAY) {
          // Back-edge found — this component has a cycle
          return true;
        }
        if (color[child] === WHITE) {
          color[child] = GRAY;
          stack.push({ node: child, childIdx: 0 });
        }
        // BLACK child → already fully explored, skip
      } else {
        // All children of `node` exhausted → mark BLACK and pop
        color[node] = BLACK;
        stack.pop();
      }
    }
  }
  return false;
}

// ===========================================================================
// HELPER — TREE BUILDER  (DFS depth + nested structure)
// ===========================================================================

/**
 * buildTree(root, adj)
 *
 * Recursively constructs a nested object representing the tree rooted at
 * `root`.  The tree maps each node to its own subtree object.
 *
 * Example output for root "A" with edges A->B, A->C, B->D:
 *   { B: { D: {} }, C: {} }
 *
 * @param {string}               root — starting node
 * @param {Map<string, string[]>} adj — adjacency list
 * @returns {{ tree: object, depth: number }}
 */
function buildTree(root, adj) {
  // Inner recursive helper
  function dfs(node) {
    const children = adj.get(node) || [];

    if (children.length === 0) {
      // Leaf node — depth is 1 (counts itself)
      return { subtree: {}, depth: 1 };
    }

    let subtree = {};
    let maxChildDepth = 0;

    for (const child of children) {
      const { subtree: childSubtree, depth: childDepth } = dfs(child);
      subtree[child] = childSubtree;
      if (childDepth > maxChildDepth) maxChildDepth = childDepth;
    }

    // This node's depth = 1 (itself) + deepest child path
    return { subtree, depth: 1 + maxChildDepth };
  }

  const { subtree, depth } = dfs(root);
  return {
    tree: { [root]: subtree },   // Wrap with root key at top level
    depth,
  };
}

// ===========================================================================
// HELPER — CONNECTED COMPONENTS  (BFS on undirected view)
// ===========================================================================

/**
 * getComponents(allNodes, adjUndirected)
 *
 * We first build an UNDIRECTED adjacency list so we can find all nodes
 * that belong to the same "island" regardless of edge direction.
 *
 * BFS from each unvisited node labels every reachable node with the same
 * component ID.  Returns an array of Sets, each Set being one component.
 *
 * @param {Set<string>}               allNodes     — every node seen
 * @param {Map<string, Set<string>>}  adjUndirected — bidirectional neighbors
 * @returns {Array<Set<string>>}
 */
function getComponents(allNodes, adjUndirected) {
  const visited = new Set();
  const components = [];

  for (const start of allNodes) {
    if (visited.has(start)) continue;

    // BFS to collect this component
    const component = new Set();
    const queue = [start];
    visited.add(start);

    while (queue.length > 0) {
      const node = queue.shift();
      component.add(node);

      for (const neighbor of (adjUndirected.get(node) || [])) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
    components.push(component);
  }
  return components;
}

// ===========================================================================
// CORE PROCESSING FUNCTION
// ===========================================================================

/**
 * processData(data)
 *
 * Master function that ties all helpers together to produce the response.
 *
 * Steps:
 *  1. Validate each entry → build invalid_entries list
 *  2. Deduplicate edges  → build duplicate_edges list
 *  3. Enforce single-parent rule (child can only have one parent)
 *  4. Build directed adjacency list + undirected neighbor map
 *  5. Find connected components
 *  6. For each component: detect cycle OR build tree
 *  7. Compile summary statistics
 */
function processData(data) {
  // ── 1. VALIDATION ──────────────────────────────────────────────────────────
  const invalid_entries = [];
  const validEdgesRaw = [];   // Edges that passed format check

  for (const entry of data) {
    const trimmed = String(entry).trim();   // Normalise whitespace
    const parsed = parseEdge(trimmed);

    if (parsed === null) {
      invalid_entries.push(trimmed);        // Collect invalid for response
    } else {
      validEdgesRaw.push({ raw: trimmed, ...parsed });
    }
  }

  // ── 2. DUPLICATE DETECTION ─────────────────────────────────────────────────
  // An edge is a duplicate if the exact "Parent->Child" pair was seen before.
  const seenEdgeKeys = new Set();
  const duplicate_edges = [];
  const uniqueEdges = [];

  for (const edge of validEdgesRaw) {
    const key = `${edge.parent}->${edge.child}`;

    if (seenEdgeKeys.has(key)) {
      duplicate_edges.push(edge.raw);   // Record duplicate; skip
    } else {
      seenEdgeKeys.add(key);
      uniqueEdges.push(edge);           // First occurrence → keep
    }
  }

  // ── 3. SINGLE-PARENT ENFORCEMENT ───────────────────────────────────────────
  // A child may only have ONE parent (first-seen parent wins).
  // Any edge that would assign a second parent to a child is silently dropped.
  const childToParent = {};   // Maps child → its assigned parent
  const finalEdges = [];

  for (const edge of uniqueEdges) {
    if (childToParent[edge.child] === undefined) {
      // This child has no parent yet — assign and keep
      childToParent[edge.child] = edge.parent;
      finalEdges.push(edge);
    }
    // else: child already has a parent → silently drop this edge
  }

  // ── 4. ADJACENCY LIST CONSTRUCTION ─────────────────────────────────────────
  // directed_adj : parent  → [children]   (for DFS / tree-building)
  // undirected   : node    → Set(neighbors) (for component detection)
  const allNodes = new Set();
  const directed_adj = new Map();   // Map<string, string[]>
  const undirected_adj = new Map();   // Map<string, Set<string>>

  // Helper to initialise empty entries
  function ensureNode(n) {
    if (!directed_adj.has(n)) directed_adj.set(n, []);
    if (!undirected_adj.has(n)) undirected_adj.set(n, new Set());
    allNodes.add(n);
  }

  for (const { parent, child } of finalEdges) {
    ensureNode(parent);
    ensureNode(child);

    directed_adj.get(parent).push(child);

    // Undirected: add both directions
    undirected_adj.get(parent).add(child);
    undirected_adj.get(child).add(parent);
  }

  // ── 5. CONNECTED COMPONENTS ────────────────────────────────────────────────
  const components = getComponents(allNodes, undirected_adj);

  // ── 6. PER-COMPONENT ANALYSIS ──────────────────────────────────────────────
  const trees = [];   // Non-cyclic components
  const cycles = [];   // Cyclic components

  for (const component of components) {
    // 6a. Cycle check using DFS
    const isCyclic = hasCycle(directed_adj, component);

    if (isCyclic) {
      // Per spec: return has_cycle:true and an empty tree {}
      // Use the lexicographically smallest node as the root label
      const cycleRoot = [...component].sort()[0];
      cycles.push({ root: cycleRoot });
      continue;
    }

    // 6b. Find the root(s) of this acyclic component.
    //     A root = node that NEVER appears as a child in finalEdges.
    //
    //     Nodes that ARE children:
    const childSet = new Set(finalEdges.map(e => e.child));

    const roots = [...component]
      .filter(n => !childSet.has(n))
      .sort();  // Lexicographic order for determinism

    if (roots.length === 0) {
      // This shouldn't happen after cycle detection, but guard anyway
      const fallback = [...component].sort()[0];
      roots.push(fallback);
    }

    // 6c. Build a tree from each root in this component
    //     (A single undirected component can have multiple disconnected
    //      subtrees if some nodes are isolated or if the graph is a forest.)
    for (const root of roots) {
      const { tree, depth } = buildTree(root, directed_adj);
      trees.push({ root, tree, depth });
    }
  }

  // ── 7. SUMMARY STATISTICS ──────────────────────────────────────────────────
  const total_trees = trees.length;
  const total_cycles = cycles.length;

  // largest_tree_root: root with greatest depth.
  // Tiebreaker: lexicographically smaller root wins.
  let largest_tree_root = null;
  if (trees.length > 0) {
    const best = trees.reduce((acc, cur) => {
      if (cur.depth > acc.depth) return cur;
      if (cur.depth === acc.depth && cur.root < acc.root) return cur;
      return acc;
    });
    largest_tree_root = best.root;
  }

  // ── 8. ASSEMBLE FINAL RESPONSE ─────────────────────────────────────────────
  const result = {
    // Identity (hardcoded per spec)
    user_id: "tarangit_chhabra_01062004",
    email_id: "tarangit0904.b23@chitkara.edu.in",
    college_roll_number: "2310990904",

    // Validation
    invalid_entries,
    duplicate_edges,

    // Trees (valid, non-cyclic)
    trees: trees.map(t => ({
      root: t.root,
      depth: t.depth,
      tree: t.tree,
    })),

    // Cycles
    cycles: cycles.map(c => ({
      root: c.root,
      has_cycle: true,
      tree: {},
    })),

    // Summary
    summary: {
      total_trees,
      total_cycles,
      largest_tree_root,
    },
  };

  return result;
}

// ===========================================================================
// ROUTES
// ===========================================================================

/**
 * POST /bfhl
 *
 * Expected request body:
 *   { "data": ["A->B", "B->C", "A-B", "hello", ...] }
 *
 * Responds with the fully processed graph analysis object.
 */
app.post("/bfhl", (req, res) => {
  try {
    const { data } = req.body;

    // ── Input Guards ──────────────────────────────────────────────────────
    if (!data) {
      return res.status(400).json({ error: "Request body must contain a 'data' field." });
    }
    if (!Array.isArray(data)) {
      return res.status(400).json({ error: "'data' must be an array of strings." });
    }

    const result = processData(data);
    return res.status(200).json(result);

  } catch (err) {
    console.error("Unhandled error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

/**
 * GET /bfhl
 * Quick health-check / operation-code endpoint.
 */
app.get("/bfhl", (_req, res) => {
  res.status(200).json({
    operation_code: 1,
    message: "BFHL API is running.",
  });
});

// ===========================================================================
// START SERVER
// ===========================================================================
app.listen(PORT, () => {
  console.log(`BFHL Server running on http://localhost:${PORT}`);
});
