/** static/js/app.jsx
 *
 * Complete React app with PROPERLY FIXED connector logic.
 *
 * KEY FIX: The connector computation now properly checks for DOM element existence
 * and uses the same reliable approach as copy1.html
 */

const { useState, useEffect, useRef } = React;

/* -------------------------
   Mock data fallback
   ------------------------- */
function generateMockData() {
  const manufacturers = [{ name: "Global Manufacturing Ltd", code: "GLOB" }];
  const sensorTypes = [
    { type: "temperature", unit: "°C", range: [20, 150] },
    { type: "pressure", unit: "PSI", range: [10, 200] },
    { type: "flow", unit: "L/min", range: [5, 500] },
    { type: "vibration", unit: "mm/s", range: [0.1, 50] },
    { type: "level", unit: "%", range: [0, 100] },
    { type: "humidity", unit: "%RH", range: [30, 90] },
  ];
  const statuses = ["online", "warning", "offline"];
  const statusWeights = [0.7, 0.2, 0.1];
  const randStatus = () => {
    const r = Math.random();
    let c = 0;
    for (let i = 0; i < statusWeights.length; i++) {
      c += statusWeights[i];
      if (r <= c) return statuses[i];
    }
    return "online";
  };
  const randValue = (sensor) => {
    const v = (
      Math.random() * (sensor.range[1] - sensor.range[0]) +
      sensor.range[0]
    ).toFixed(1);
    return `${v} ${sensor.unit}`;
  };

  const data = {};
  manufacturers.forEach((manu, mi) => {
    const mid = `manufacturer-${mi + 1}`;
    data[mid] = {
      id: mid,
      name: manu.name,
      type: "manufacturer",
      description: `Global industrial manufacturer - ${manu.code}`,
      parentId: null,
      children: {},
    };

    ["Automotive", "Electronics"].forEach((seg, si) => {
      const sid = `${mid}-segment-${si + 1}`;
      data[mid].children[sid] = {
        id: sid,
        name: `${seg} Division`,
        type: "segment",
        description: `${seg} business unit`,
        parentId: mid,
        children: {},
      };

      ["North America", "Asia"].forEach((site, sidx) => {
        const siteId = `${sid}-site-${sidx + 1}`;
        data[mid].children[sid].children[siteId] = {
          id: siteId,
          name: `${site} Site`,
          type: "site",
          description: `${site} regional manufacturing site`,
          parentId: sid,
          children: {},
        };

        ["Assembly Plant", "Processing Plant"].forEach((plant, pidx) => {
          const pid = `${siteId}-plant-${pidx + 1}`;
          data[mid].children[sid].children[siteId].children[pid] = {
            id: pid,
            name: plant,
            type: "plant",
            description: `${plant} capacity ${Math.floor(
              Math.random() * 1000 + 200
            )} units/day`,
            parentId: siteId,
            children: {},
          };

          ["Production", "Quality"].forEach((fn, fidx) => {
            const fid = `${pid}-function-${fidx + 1}`;
            data[mid].children[sid].children[siteId].children[pid].children[
              fid
            ] = {
              id: fid,
              name: `${fn} Function`,
              type: "function",
              description: `${fn} operations`,
              parentId: pid,
              children: {},
            };

            ["Control System", "Monitoring System"].forEach((sys, ssy) => {
              const sysId = `${fid}-system-${ssy + 1}`;
              data[mid].children[sid].children[siteId].children[pid].children[
                fid
              ].children[sysId] = {
                id: sysId,
                name: sys,
                type: "system",
                description: `${sys} for automation`,
                parentId: fid,
                children: {},
              };

              ["Machine A", "Machine B"].forEach((mach, midx) => {
                const machId = `${sysId}-machine-${midx + 1}`;
                data[mid].children[sid].children[siteId].children[pid].children[
                  fid
                ].children[sysId].children[machId] = {
                  id: machId,
                  name: mach,
                  type: "machine",
                  description: `Industrial ${mach}`,
                  parentId: sysId,
                  children: {},
                };

                ["Stage 1", "Stage 2"].forEach((st, stidx) => {
                  const stId = `${machId}-stage-${stidx + 1}`;
                  data[mid].children[sid].children[siteId].children[
                    pid
                  ].children[fid].children[sysId].children[machId].children[
                    stId
                  ] = {
                    id: stId,
                    name: st,
                    type: "stage",
                    description: `${st} processing`,
                    parentId: machId,
                    children: {},
                  };

                  for (let s = 0; s < 2; s++) {
                    const sensorType =
                      sensorTypes[(s + stidx) % sensorTypes.length];
                    const senId = `${stId}-sensor-${s + 1}`;
                    data[mid].children[sid].children[siteId].children[
                      pid
                    ].children[fid].children[sysId].children[machId].children[
                      stId
                    ].children[senId] = {
                      id: senId,
                      name: `${
                        sensorType.type.charAt(0).toUpperCase() +
                        sensorType.type.slice(1)
                      } Sensor ${s + 1}`,
                      type: "sensor",
                      description: `${sensorType.type} monitoring at ${st}`,
                      parentId: stId,
                      status: randStatus(),
                      value: randValue(sensorType),
                      lastUpdate: new Date(
                        Date.now() - Math.random() * 3600000
                      ).toLocaleString(),
                    };
                  }
                });
              });
            });
          });
        });
      });
    });
  });

  return data;
}

/* -------------------------
   Layout helpers
   ------------------------- */
const NODE_HEIGHT = 160;
const V_GAP = 28;
const X_SPACING = 220;
const LEFT_MARGIN = 60;
const RIGHT_PADDING = 160;

function computeSubtreeSizes(roots, expandedSet) {
  const sizes = {};
  const dfs = (node) => {
    if (!node) return 1;
    const hasChildren = node.children && Object.keys(node.children).length > 0;
    if (!hasChildren || !expandedSet.has(node.id)) {
      sizes[node.id] = 1;
      return 1;
    }
    let sum = 0;
    for (const child of Object.values(node.children)) {
      sum += dfs(child);
    }
    sizes[node.id] = Math.max(1, sum);
    return sizes[node.id];
  };

  for (const r of Object.values(roots || {})) dfs(r);
  return sizes;
}

function layoutTreeBySizes(roots, sizes) {
  const copy = JSON.parse(JSON.stringify(roots));
  const unit = NODE_HEIGHT + V_GAP;
  const rootHeights = {};
  for (const r of Object.values(copy)) {
    const sz = sizes[r.id] || 1;
    const h = Math.max(600, sz * unit);
    rootHeights[r.id] = h;
  }

  let currentY = 0;
  let maxX = 0;

  const layoutNode = (node, depth, yStart, nodeTotalHeight) => {
    node.x = LEFT_MARGIN + depth * X_SPACING;

    const id = node.id;
    const nodeSize = sizes[id] || 1;
    const hasChildren = node.children && Object.keys(node.children).length > 0;
    if (
      !hasChildren ||
      nodeTotalHeight <= 0 ||
      nodeSize === 1 ||
      !node.children
    ) {
      node.y = yStart + nodeTotalHeight / 2;
      maxX = Math.max(maxX, node.x);
      return [node.y];
    }

    const children = Object.values(node.children);
    const totalChildSize = children.reduce((s, c) => s + (sizes[c.id] || 1), 0);
    let childYs = [];
    let cursor = yStart;
    for (const child of children) {
      const childSize = sizes[child.id] || 1;
      const childHeight = (nodeTotalHeight * childSize) / totalChildSize;
      const ys = layoutNode(child, depth + 1, cursor, childHeight) || [];
      childYs = childYs.concat(ys);
      cursor += childHeight;
    }
    node.y = childYs.reduce((a, b) => a + b, 0) / childYs.length;
    maxX = Math.max(maxX, node.x);
    return [node.y];
  };

  for (const r of Object.values(copy)) {
    const rootHeight = rootHeights[r.id];
    layoutNode(r, 0, currentY, rootHeight);
    currentY += rootHeight;
  }

  const requiredWidth = maxX + 200 + RIGHT_PADDING;
  const requiredHeight = currentY + V_GAP;

  return { tree: copy, width: requiredWidth, height: requiredHeight };
}

function findPathToNode(roots, targetId) {
  for (const root of Object.values(roots || {})) {
    const r = dfs(root, targetId);
    if (r) return r;
  }
  return [];
}
function dfs(node, target) {
  if (!node) return null;
  if (node.id === target) return [node];
  if (!node.children) return null;
  for (const child of Object.values(node.children)) {
    const res = dfs(child, target);
    if (res) return [node, ...res];
  }
  return null;
}

function countSensors(roots) {
  let total = 0,
    online = 0,
    warning = 0,
    offline = 0;
  const recurse = (n) => {
    if (!n) return;
    if (n.type === "sensor") {
      total++;
      if (n.status === "online") online++;
      else if (n.status === "warning") warning++;
      else offline++;
    }
    if (n.children) for (const c of Object.values(n.children)) recurse(c);
  };
  for (const r of Object.values(roots || {})) recurse(r);
  return { total, online, warning, offline };
}

function findNodeById(roots, targetId) {
  for (const r of Object.values(roots || {})) {
    const found = findNodeRef(r, targetId);
    if (found) return found;
  }
  return null;
}
function findNodeRef(node, id) {
  if (!node) return null;
  if (node.id === id) return node;
  if (!node.children) return null;
  for (const c of Object.values(node.children)) {
    const s = findNodeRef(c, id);
    if (s) return s;
  }
  return null;
}

/* -------------------------
   App component - FIXED CONNECTOR LOGIC
   ------------------------- */
function App() {
  const [data, setData] = useState(null);
  const [expandedSet, setExpandedSet] = useState(new Set());
  const [activeExpandedNode, setActiveExpandedNode] = useState(null);
  const [search, setSearch] = useState("");
  const [spreadNodeId, setSpreadNodeId] = useState(null);

  const prevScrollRef = useRef({ left: 0, top: 0 });
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const treeContainerRef = useRef(null);

  const [paths, setPaths] = useState([]);
  const [treeLayout, setTreeLayout] = useState({});
  const [contentSize, setContentSize] = useState({ width: 1000, height: 800 });

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  /* Load data */
  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        if (typeof window.fetchTreeData === "function") {
          const fetched = await window.fetchTreeData();
          if (mounted && fetched && Object.keys(fetched).length > 0) {
            setData(fetched);
            setLoading(false);
            return;
          }
        }
        const fallback = generateMockData();
        if (mounted) {
          setData(fallback);
          setLoading(false);
        }
      } catch (err) {
        console.warn("fetchTreeData failed:", err);
        if (mounted) {
          setData(generateMockData());
          setLoading(false);
          setLoadError(err && err.message ? err.message : String(err));
        }
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  /* Recompute layout */
  useEffect(() => {
    if (!data) return;
    const rootsToLayout = spreadNodeId
      ? { [spreadNodeId]: findNodeById(data, spreadNodeId) }
      : data;
    const sizes = computeSubtreeSizes(rootsToLayout, expandedSet);
    const { tree, width, height } = layoutTreeBySizes(rootsToLayout, sizes);
    setTreeLayout(tree);
    setContentSize({ width, height });
  }, [data, expandedSet, spreadNodeId]);

  /* FIXED: Connector computation - using the reliable approach from copy1.html */
  useEffect(() => {
    const computePaths = () => {
      const rootEl = containerRef.current;
      const svgEl = svgRef.current;
      const treeContainerEl = treeContainerRef.current;

      if (!rootEl || !svgEl || !treeContainerEl) return;

      // Set tree container dimensions
      treeContainerEl.style.width = contentSize.width + "px";
      treeContainerEl.style.height = contentSize.height + "px";

      // Get container bounding rect for coordinate conversion
      const containerRect = rootEl.getBoundingClientRect();

      // Gather all DOM node elements and map their positions
      const rects = {};
      rootEl.querySelectorAll("[data-node-id]").forEach((el) => {
        const id = el.dataset.nodeId;
        const elRect = el.getBoundingClientRect();

        // Convert to coordinates relative to container's content (accounting for scroll)
        const x = elRect.left - containerRect.left + rootEl.scrollLeft;
        const y = elRect.top - containerRect.top + rootEl.scrollTop;

        rects[id] = {
          left: x,
          top: y,
          right: x + elRect.width,
          bottom: y + elRect.height,
          width: elRect.width,
          height: elRect.height,
        };
      });

      // Set SVG size to tree container's actual dimensions
      const contentWidth = treeContainerEl.offsetWidth;
      const contentHeight = treeContainerEl.offsetHeight;

      svgEl.setAttribute("width", contentWidth);
      svgEl.setAttribute("height", contentHeight);
      svgEl.setAttribute("viewBox", `0 0 ${contentWidth} ${contentHeight}`);
      svgEl.style.width = contentWidth + "px";
      svgEl.style.height = contentHeight + "px";

      // Build connector paths
      const newPaths = [];
      const rootsToWalk = spreadNodeId
        ? { [spreadNodeId]: findNodeById(data, spreadNodeId) }
        : data;

      const walk = (node) => {
        if (!node) return;
        if (node.children) {
          for (const child of Object.values(node.children)) {
            const parentVisible = !!rects[node.id];
            const childVisible = !!rects[child.id];
            const parentExpanded = expandedSet.has(node.id);

            // Connect only when both parent and child DOM elements exist AND parent is expanded
            if (parentVisible && childVisible && parentExpanded) {
              const p1 = rects[node.id];
              const p2 = rects[child.id];
              const x1 = p1.right;
              const y1 = p1.top + p1.height / 2;
              const x2 = p2.left;
              const y2 = p2.top + p2.height / 2;
              newPaths.push({ x1, y1, x2, y2 });
            }

            // Always recursively walk children
            walk(child);
          }
        }
      };

      for (const r of Object.values(rootsToWalk || {})) walk(r);
      setPaths(newPaths);
    };

    // Compute immediately
    computePaths();

    // Set up observers for dynamic updates
    const canvas = containerRef.current;
    let raf = null;

    const scheduleCompute = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => computePaths());
    };

    if (canvas) {
      canvas.addEventListener("scroll", scheduleCompute, { passive: true });
      const ro = new ResizeObserver(scheduleCompute);
      ro.observe(canvas);

      const mo = new MutationObserver(scheduleCompute);
      mo.observe(canvas, {
        childList: true,
        subtree: true,
        attributes: true,
      });

      window.addEventListener("resize", scheduleCompute);

      return () => {
        canvas.removeEventListener("scroll", scheduleCompute);
        ro.disconnect();
        mo.disconnect();
        window.removeEventListener("resize", scheduleCompute);
        if (raf) cancelAnimationFrame(raf);
      };
    } else {
      window.addEventListener("resize", scheduleCompute);
      return () => {
        window.removeEventListener("resize", scheduleCompute);
        if (raf) cancelAnimationFrame(raf);
      };
    }
  }, [data, expandedSet, treeLayout, contentSize, spreadNodeId]);

  /* Collapse helper */
  const collapseChildrenRecursively = (nodeId, expandedSetInPlace) => {
    const node = findNodeById(data, nodeId);
    if (!node || !node.children) return expandedSetInPlace;
    for (const child of Object.values(node.children)) {
      expandedSetInPlace.delete(child.id);
      collapseChildrenRecursively(child.id, expandedSetInPlace);
    }
    return expandedSetInPlace;
  };

  /* Expand/collapse handlers */
  const onExpandToggle = (node) => {
    setExpandedSet((prev) => {
      const s = new Set(prev);
      if (s.has(node.id)) {
        s.delete(node.id);
        collapseChildrenRecursively(node.id, s);
        if (activeExpandedNode === node.id) setActiveExpandedNode(null);
      } else {
        s.add(node.id);
        setActiveExpandedNode(node.id);
      }
      return s;
    });
  };

  const onSpreadToggle = (node) => {
    const containerEl = containerRef.current;
    if (!containerEl) {
      setSpreadNodeId((prev) => (prev === node.id ? null : node.id));
      return;
    }
    if (spreadNodeId === node.id) {
      setSpreadNodeId(null);
      requestAnimationFrame(() => {
        setTimeout(() => {
          const prev = prevScrollRef.current || { left: 0, top: 0 };
          containerEl.scrollTo({
            left: prev.left,
            top: prev.top,
            behavior: "smooth",
          });
        }, 120);
      });
    } else {
      prevScrollRef.current = {
        left: containerEl.scrollLeft,
        top: containerEl.scrollTop,
      };
      setSpreadNodeId(node.id);
    }
  };

  /* Auto-scroll to spread node */
  useEffect(() => {
    if (!spreadNodeId) return;
    const container = containerRef.current;
    if (!container) return;
    const timer = setTimeout(() => {
      const nodeEl = container.querySelector(
        `[data-node-id="${spreadNodeId}"]`
      );
      if (!nodeEl) return;
      const containerRect = container.getBoundingClientRect();
      const elRect = nodeEl.getBoundingClientRect();
      const elLeftWithinContent =
        elRect.left - containerRect.left + container.scrollLeft;
      const elTopWithinContent =
        elRect.top - containerRect.top + container.scrollTop;
      const desiredLeftWithinContent = LEFT_MARGIN;
      const desiredTopWithinContent = Math.max(
        0,
        elTopWithinContent - container.clientHeight / 2 + elRect.height / 2
      );
      const newScrollLeft = Math.max(
        0,
        Math.round(elLeftWithinContent - desiredLeftWithinContent)
      );
      const newScrollTop = Math.max(0, Math.round(desiredTopWithinContent));
      container.scrollTo({
        left: newScrollLeft,
        top: newScrollTop,
        behavior: "smooth",
      });
    }, 120);
    return () => clearTimeout(timer);
  }, [spreadNodeId, treeLayout, contentSize]);

  /* Get visible nodes */
  const getVisibleNodes = (roots) => {
    const visibleNodes = [];
    const shouldShow = (node) => {
      if (!search) return true;
      const sq = String(search).toLowerCase();
      if (
        (node.name && node.name.toLowerCase().includes(sq)) ||
        (node.description && node.description.toLowerCase().includes(sq)) ||
        (node.value && node.value.toString().toLowerCase().includes(sq))
      )
        return true;
      if (node.children) {
        return Object.values(node.children).some((child) => shouldShow(child));
      }
      return false;
    };
    const recurse = (node, parentExpanded = true) => {
      if (!shouldShow(node)) return;
      if (node.parentId === null || parentExpanded) visibleNodes.push(node);
      if (node.children && expandedSet.has(node.id)) {
        for (const child of Object.values(node.children))
          recurse(child, expandedSet.has(node.id));
      } else {
        if (node.children) {
          for (const child of Object.values(node.children))
            recurse(child, false);
        }
      }
    };
    for (const r of Object.values(roots || {})) recurse(r);
    return visibleNodes;
  };

  const visibleNodes = getVisibleNodes(treeLayout || {});
  const stats = countSensors(data || {});

  /* Node icon helper */
  const nodeIconClass = (type) => {
    switch (type) {
      case "manufacturer":
        return "icon-manufacturer";
      case "segment":
        return "icon-segment";
      case "site":
        return "icon-site";
      case "plant":
        return "icon-plant";
      case "function":
        return "icon-function";
      case "system":
        return "icon-system";
      case "machine":
        return "icon-machine";
      case "stage":
        return "icon-stage";
      case "sensor":
        return "icon-sensor";
      default:
        return "icon-manufacturer";
    }
  };

  /* Render node */
  const renderNode = (node) => {
    const isActive = activeExpandedNode === node.id;
    const activePath = activeExpandedNode
      ? findPathToNode(data, activeExpandedNode).map((n) => n.id)
      : [];
    const isShrunk =
      activeExpandedNode &&
      node.parentId &&
      activePath.includes(node.parentId) &&
      node.id !== activeExpandedNode;
    const onPath = activePath.includes(node.id);

    return (
      <div
        key={node.id}
        data-node-id={node.id}
        className={`tree-node ${isActive ? "selected" : ""} ${
          isShrunk ? "shrunk" : ""
        } ${onPath ? "branch" : ""}`}
        style={{ left: `${node.x}px`, top: `${node.y}px` }}
      >
        <div className="node-content">
          <div className="node-header">
            <div className={`node-icon ${nodeIconClass(node.type)}`}>
              <i
                className={
                  node.type === "sensor"
                    ? node.status === "online"
                      ? "fas fa-circle"
                      : node.status === "warning"
                      ? "fas fa-exclamation-triangle"
                      : "fas fa-times-circle"
                    : node.type === "manufacturer"
                    ? "fas fa-industry"
                    : node.type === "segment"
                    ? "fas fa-sitemap"
                    : node.type === "site"
                    ? "fas fa-map-marker-alt"
                    : node.type === "plant"
                    ? "fas fa-building"
                    : node.type === "function"
                    ? "fas fa-cogs"
                    : node.type === "system"
                    ? "fas fa-microchip"
                    : node.type === "machine"
                    ? "fas fa-robot"
                    : "fas fa-layer-group"
                }
              ></i>
            </div>
            <div>
              <div className="node-title">{node.name}</div>
              <div className="node-meta">
                {node.type} {node.value ? `· ${node.value}` : ""}
              </div>
            </div>
          </div>

          <div className="node-meta">{node.description}</div>

          <div
            className={`spread-button ${
              spreadNodeId === node.id ? "active" : ""
            }`}
            onClick={(e) => {
              e.stopPropagation();
              onSpreadToggle(node);
            }}
            title={
              spreadNodeId === node.id
                ? "Unspread (restore view)"
                : "Spread (focus here)"
            }
            aria-pressed={spreadNodeId === node.id}
          >
            <i className="fas fa-arrows-alt"></i>
          </div>

          {node.children && Object.keys(node.children).length > 0 && (
            <div
              className={`expand-button ${
                expandedSet.has(node.id) ? "expanded" : ""
              }`}
              onClick={(e) => {
                e.stopPropagation();
                onExpandToggle(node);
              }}
              title={expandedSet.has(node.id) ? "Collapse" : "Expand"}
              aria-expanded={expandedSet.has(node.id)}
            >
              <i
                className={`fas ${
                  expandedSet.has(node.id) ? "fa-minus" : "fa-plus"
                }`}
              ></i>
            </div>
          )}
        </div>
      </div>
    );
  };

  /* Build levels */
  const buildLevels = (roots) => {
    const levels = [];
    const shouldShow = (node) => {
      if (!search) return true;
      const sq = search.toLowerCase();
      if (
        (node.name && node.name.toLowerCase().includes(sq)) ||
        (node.description && node.description.toLowerCase().includes(sq)) ||
        (node.value && node.value.toString().toLowerCase().includes(sq))
      )
        return true;
      if (node.children) {
        return Object.values(node.children).some((child) => shouldShow(child));
      }
      return false;
    };
    const recurse = (node, level, parentExpanded = true) => {
      if (!shouldShow(node)) return;
      levels[level] = levels[level] || [];
      if (level === 0 || parentExpanded) levels[level].push(node);
      if (node.children && expandedSet.has(node.id)) {
        for (const child of Object.values(node.children))
          recurse(child, level + 1, expandedSet.has(node.id));
      } else {
        if (node.children) {
          for (const child of Object.values(node.children))
            recurse(child, level + 1, false);
        }
      }
    };
    for (const r of Object.values(roots || {})) recurse(r, 0);
    return levels.filter((l) => l && l.length > 0);
  };

  const levels = buildLevels(data || {});

  const onExpandAll = () => {
    if (!levels || levels.length === 0) return;
    const lastLevel = levels[levels.length - 1];
    const idsToExpand = lastLevel
      .filter((n) => n.children && Object.keys(n.children).length > 0)
      .map((n) => n.id);
    if (idsToExpand.length === 0) return;
    setExpandedSet((prev) => {
      const s = new Set(prev);
      idsToExpand.forEach((id) => s.add(id));
      return s;
    });
    setActiveExpandedNode(null);
  };

  const onCollapsePrev = () => {
    if (!levels || levels.length <= 1) return;
    const parentLevelIndex = levels.length - 2;
    const parentLevel = levels[parentLevelIndex];

    setExpandedSet((prev) => {
      const s = new Set(prev);
      for (const node of parentLevel) {
        s.delete(node.id);
        collapseChildrenRecursively(node.id, s);
      }
      return s;
    });

    setActiveExpandedNode(null);
  };

  const breadcrumbLabel = () => {
    if (spreadNodeId) {
      const path = findPathToNode(data, spreadNodeId);
      if (path && path.length) return path.map((n) => n.name).join(" › ");
      return "Focused subtree";
    }
    if (activeExpandedNode) {
      const p = findPathToNode(data, activeExpandedNode);
      return p.map((n) => n.name).join(" › ");
    }
    return "Click an expand (+) button to highlight a path";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-600 text-lg font-semibold">
        Loading system tree...
      </div>
    );
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              background: "#2563eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
            }}
          >
            <i className="fas fa-industry"></i>
          </div>
          <div>
            <h1>Sensor Management</h1>
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              Demo — Tree Layout
            </div>
          </div>
        </div>

        <div className="search-box">
          <i className="fas fa-search"></i>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search nodes, sensors, values..."
          />
        </div>

        <div
          className="sidebar-controls"
          role="group"
          aria-label="Expand or collapse levels step by step"
          style={{
            marginTop: 6,
            display: "flex",
            gap: 8,
            alignItems: "center",
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onExpandAll();
            }}
            title="Expand next level"
            disabled={
              !(
                levels &&
                levels.length &&
                levels[levels.length - 1].some(
                  (n) => n.children && Object.keys(n.children).length > 0
                )
              )
            }
            style={{
              flex: 1,
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid rgba(0, 0, 0, 0.06)",
              cursor: "pointer",
              fontSize: 13,
              display: "flex",
              gap: 8,
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.2s, transform 0.15s",
              background: "linear-gradient(90deg, #37dda9, #2fb58a)",
              color: "white",
              borderColor: "rgba(80, 105, 63, 0.7)",
            }}
          >
            <i className="fas fa-expand-arrows-alt" aria-hidden="true"></i>
            <span style={{ fontWeight: 600 }}>Expand Next</span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onCollapsePrev();
            }}
            title="Collapse previous level"
            disabled={!(levels && levels.length > 1)}
            style={{
              flex: 1,
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid rgba(0, 0, 0, 0.06)",
              cursor: "pointer",
              fontSize: 13,
              display: "flex",
              gap: 8,
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.2s, transform 0.15s",
              background: "linear-gradient(90deg, #e55656, #c94444)",
              color: "white",
              borderColor: "rgba(217, 80, 80, 0.9)",
            }}
          >
            <i className="fas fa-compress-arrows-alt" aria-hidden="true"></i>
            <span style={{ fontWeight: 600 }}>Collapse Prev</span>
          </button>
        </div>

        <div className="overview">
          <div style={{ fontSize: 13, fontWeight: 700, color: "#92400e" }}>
            System Overview
          </div>
          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
            <div className="stat">
              <div style={{ fontSize: 18, fontWeight: 800, color: "#111827" }}>
                {stats.total}
              </div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                Total Sensors
              </div>
            </div>
            <div className="stat">
              <div style={{ fontSize: 18, fontWeight: 800, color: "#059669" }}>
                {stats.online}
              </div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Online</div>
            </div>
          </div>
          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
            <div className="stat">
              <div style={{ fontSize: 18, fontWeight: 800, color: "#f59e0b" }}>
                {stats.warning}
              </div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Warning</div>
            </div>
            <div className="stat">
              <div style={{ fontSize: 18, fontWeight: 800, color: "#ef4444" }}>
                {stats.offline}
              </div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Offline</div>
            </div>
          </div>
        </div>

        <div className="breadcrumb">
          <strong style={{ fontSize: 13 }}>Navigation:</strong>
          <span style={{ marginLeft: 10, color: "#374151", fontSize: 13 }}>
            {breadcrumbLabel()}
          </span>
        </div>
      </aside>

      <main className="main">
        <div className="canvas" ref={containerRef}>
          <svg
            ref={svgRef}
            className="connector-svg"
            xmlns="http://www.w3.org/2000/svg"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              pointerEvents: "none",
              zIndex: 2,
            }}
          >
            {paths.map((p, idx) => {
              const { x1, y1, x2, y2 } = p;
              const dx = Math.max(40, Math.abs(x2 - x1) * 0.25);
              const c1x = x1 + dx;
              const c2x = x2 - dx;
              const d = `M ${x1} ${y1} C ${c1x} ${y1} ${c2x} ${y2} ${x2} ${y2}`;
              return <path key={idx} className="connector-path" d={d} />;
            })}
          </svg>

          <div className="tree-container" ref={treeContainerRef}>
            {visibleNodes.map((node) => renderNode(node))}
          </div>
        </div>
      </main>
    </div>
  );
}

/* Mounting */
(function mount() {
  const rootEl = document.getElementById("root");
  if (!rootEl) {
    console.error("No #root element to mount App.");
    return;
  }
  if (ReactDOM.createRoot) {
    const root = ReactDOM.createRoot(rootEl);
    root.render(<App />);
  } else {
    ReactDOM.render(<App />, rootEl);
  }
})();
