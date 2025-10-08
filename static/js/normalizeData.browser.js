// static/js/normalizeData.browser.js
(function () {
  // Browser-friendly normalizeData implementation (adapted from your normalizeData.js)
  // Exposes window.normalizeData(raw)

  const POSITIONS_FOR_SLASH = [4, 7, 10, 13, 16, 19, 22, 25];
  const LEVEL_TYPES = [
    "manufacturer",
    "segment",
    "site",
    "plant",
    "function",
    "system",
    "machine",
    "stage",
    "sensor",
  ];

  function slugify(s) {
    return (
      String(s || "")
        .trim()
        .replace(/\s+/g, "_")
        .replace(/[^a-zA-Z0-9_\-]/g, "")
        .slice(0, 80) || "node"
    );
  }

  function insertSlashesForIotTag(tag) {
    if (!tag || typeof tag !== "string") return String(tag || "");
    const chars = [];
    const positions = new Set(POSITIONS_FOR_SLASH);
    for (let i = 0; i < tag.length; i++) {
      if (positions.has(i)) chars.push("/");
      chars.push(tag[i]);
    }
    return chars.join("");
  }

  function buildFromPaths(paths) {
    const roots = {};
    const nodes = {};
    for (const rawPath of paths) {
      if (!rawPath) continue;
      const parts = String(rawPath)
        .replace(/\\/g, "/")
        .split("/")
        .map((p) => (p === "" ? "###" : p.trim()))
        .filter(Boolean);
      let parentId = null;
      for (let idx = 0; idx < parts.length; idx++) {
        const name = parts[idx] || "###";
        const idPart = slugify(name);
        const id = parentId ? `${parentId}/${idPart}` : idPart;
        if (!nodes[id]) {
          nodes[id] = {
            id,
            name,
            type: LEVEL_TYPES[idx] || `level${idx}`,
            description: "",
            parentId: parentId,
            children: {},
          };
        }
        if (!parentId) {
          roots[nodes[id].id] = nodes[id];
        } else {
          if (!nodes[parentId]) {
            nodes[parentId] = {
              id: parentId,
              name: parentId.split("/").pop(),
              type: LEVEL_TYPES[Math.max(0, idx - 1)] || "level",
              description: "",
              parentId: parentId.includes("/")
                ? parentId.split("/").slice(0, -1).join("/")
                : null,
              children: {},
            };
            if (!nodes[parentId].parentId)
              roots[nodes[parentId].id] = nodes[parentId];
          }
          nodes[parentId].children[nodes[id].id] = nodes[id];
        }
        parentId = id;
      }
    }
    return roots;
  }

  function nestedListToPaths(nested) {
    const paths = [];
    const stack = [];
    function dfs(node) {
      if (typeof node === "string") {
        stack.push(node);
        paths.push(stack.join("/"));
        stack.pop();
        return;
      }
      if (Array.isArray(node)) {
        if (node.length === 0) return;
        const name = node[0];
        stack.push(name);
        if (node.length === 1) {
          paths.push(stack.join("/"));
        } else {
          for (let i = 1; i < node.length; i++) dfs(node[i]);
        }
        stack.pop();
        return;
      }
      if (typeof node === "object" && node !== null) {
        if (node.name && (node.children || node.child)) {
          stack.push(node.name);
          const children = node.children || node.child || [];
          for (const c of children) dfs(c);
          stack.pop();
          return;
        }
        for (const val of Object.values(node)) dfs(val);
      }
    }
    if (Array.isArray(nested)) {
      for (const item of nested) dfs(item);
    } else {
      dfs(nested);
    }
    return Array.from(new Set(paths));
  }

  function normalizeNodeMap(rawMap) {
    const map = JSON.parse(JSON.stringify(rawMap || {}));
    const resultRoots = {};
    const created = {};

    function ensureNode(id, partial = {}) {
      if (created[id]) return created[id];
      const node = {
        id,
        name: partial.name || partial.id || id.split("/").pop() || id,
        type: partial.type || "level",
        description: partial.description || "",
        parentId:
          partial.parentId !== undefined
            ? partial.parentId
            : partial.parent || null,
        children: {},
        ...(partial.status ? { status: partial.status } : {}),
        ...(partial.value !== undefined
          ? { value: partial.value === "NaN" ? null : partial.value }
          : {}),
        ...(partial.lastUpdate ? { lastUpdate: partial.lastUpdate } : {}),
      };
      created[id] = node;
      return node;
    }

    if (typeof map === "object") {
      for (const [k, v] of Object.entries(map)) {
        const nodeId = v && v.id ? v.id : k || slugify(String(v));
        const base = ensureNode(nodeId, v || {});
        if (v && v.children) {
          if (Array.isArray(v.children)) {
            v.children.forEach((child, i) => {
              if (typeof child === "string") {
                const cid = `${nodeId}/${slugify(child)}`;
                const childNode = ensureNode(cid, {
                  name: child,
                  parentId: nodeId,
                });
                base.children[childNode.id] = childNode;
              } else if (child && child.id) {
                const childNode = ensureNode(child.id, {
                  ...child,
                  parentId: nodeId,
                });
                base.children[childNode.id] = childNode;
              } else {
                const cid = `${nodeId}/c${i}`;
                const childNode = ensureNode(cid, {
                  ...child,
                  parentId: nodeId,
                });
                base.children[childNode.id] = childNode;
              }
            });
          } else if (typeof v.children === "object") {
            for (const [ck, cv] of Object.entries(v.children)) {
              const childNode = ensureNode(cv.id || ck, {
                ...(cv || {}),
                parentId: nodeId,
              });
              base.children[childNode.id] = childNode;
            }
          }
        }
        if (!base.parentId) resultRoots[base.id] = base;
      }

      for (const id of Object.keys(created)) {
        const node = created[id];
        if (node.parentId) {
          if (!created[node.parentId]) {
            ensureNode(node.parentId, {
              name: node.parentId.split("/").pop(),
              parentId: null,
            });
          }
          created[node.parentId].children[node.id] = node;
          if (!created[node.parentId].parentId)
            resultRoots[created[node.parentId].id] = created[node.parentId];
        }
      }

      if (Object.keys(resultRoots).length === 0) {
        for (const id of Object.keys(created)) {
          if (!created[id].parentId) resultRoots[id] = created[id];
        }
      }

      return resultRoots;
    }

    return {};
  }

  function normalizeData(raw) {
    if (raw == null) return {};

    if (typeof raw === "object" && !Array.isArray(raw)) {
      const values = Object.values(raw);
      if (
        values.length &&
        values.every((v) => v && (v.id || v.name || v.children))
      ) {
        try {
          return normalizeNodeMap(raw);
        } catch (e) {}
      }
      if (raw.id && raw.name) {
        const copy = JSON.parse(JSON.stringify(raw));
        if (Array.isArray(copy.children)) {
          const childrenMap = {};
          copy.children.forEach((c) => {
            if (c && c.id) childrenMap[c.id] = c;
          });
          copy.children = childrenMap;
        }
        if (
          String(copy.id).toLowerCase() === "root" ||
          String(copy.name).toLowerCase() === "root" ||
          String(copy.type || "").toLowerCase() === "root"
        ) {
          const result = {};
          if (copy.children && typeof copy.children === "object") {
            for (const [ck, cv] of Object.entries(copy.children)) {
              const child = JSON.parse(JSON.stringify(cv || {}));
              child.parentId = child.parentId || null;
              result[child.id || ck] = child;
            }
          }
          return result;
        }
        return { [copy.id]: copy };
      }
    }

    if (Array.isArray(raw)) {
      if (raw.every((r) => typeof r === "string" && r.includes("/"))) {
        return buildFromPaths(raw);
      }

      if (raw.every((r) => typeof r === "string")) {
        const looksLikeCompactTag = raw.every(
          (r) => typeof r === "string" && !r.includes("/") && r.length >= 20
        );
        if (looksLikeCompactTag) {
          const paths = raw.map((s) => insertSlashesForIotTag(s));
          return buildFromPaths(paths);
        }
        const paths = raw.map((s) =>
          s.includes("/") ? s : insertSlashesForIotTag(s)
        );
        return buildFromPaths(paths);
      }

      if (raw.every((r) => typeof r === "object" && r !== null)) {
        const paths = [];
        for (const item of raw) {
          if (item.IOTPATH) paths.push(item.IOTPATH);
          else if (item.path) paths.push(item.path);
          else if (item.pathString) paths.push(item.pathString);
          else if (item.IOTTAG) {
            const t = String(item.IOTTAG);
            paths.push(t.includes("/") ? t : insertSlashesForIotTag(t));
          } else if (typeof item === "object" && item.name && item.children) {
            return normalizeNodeMap(
              raw.reduce((acc, cur, i) => {
                const id = cur.id || `n${i}`;
                acc[id] = cur;
                return acc;
              }, {})
            );
          } else {
            const s = Object.values(item).find(
              (v) => typeof v === "string" && v.includes("/")
            );
            if (s) paths.push(s);
          }
        }
        if (paths.length) return buildFromPaths(paths);
        return normalizeNodeMap(
          raw.reduce((acc, cur, i) => {
            const id = cur.id || `node_${i}`;
            acc[id] = cur;
            return acc;
          }, {})
        );
      }
    }

    if (typeof raw === "string") {
      if (raw.includes("/")) {
        return buildFromPaths([raw]);
      }
      if (raw.length >= 20) {
        return buildFromPaths([insertSlashesForIotTag(raw)]);
      }
      const id = slugify(raw);
      return {
        [id]: {
          id,
          name: raw,
          type: "root",
          description: "",
          parentId: null,
          children: {},
        },
      };
    }

    return {};
  }

  // expose
  window.normalizeData = normalizeData;
})();
