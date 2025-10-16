// treeApp-vertical.js
// Vertical layout computation for TreeApp

TreeApp.prototype.computeVerticalLayout = function(visibleNodes, renderedSize) {
  if (!visibleNodes || this.layoutMode !== "vertical") return null;
  
  const levels = new Map();
  for (const n of visibleNodes) {
    const d = n.depth || 0;
    if (!levels.has(d)) levels.set(d, []);
    levels.get(d).push(n);
  }
  
  // Build parent-child relationships for single-child alignment
  const nodeMap = new Map();
  const childrenMap = new Map();
  for (const n of visibleNodes) {
    nodeMap.set(n.id, n);
    if (n.children) {
      const childIds = Object.values(n.children)
        .filter(c => visibleNodes.some(vn => vn.id === c.id))
        .map(c => c.id);
      childrenMap.set(n.id, childIds);
    }
  }
  
  const positions = new Map();
  const horizontalMargin = 80;
  const minGap = 40;
  const topMargin = LEFT_MARGIN;
  const levelSpacing = NODE_HEIGHT + 80; // Increased spacing between levels for better visual separation
  const containerAvailWidth = Math.max(
    400,
    (renderedSize && renderedSize.width) || 1000
  );
  let requiredWidth = containerAvailWidth;
  
  const sortedDepths = Array.from(levels.keys()).sort((a, b) => a - b);
  for (const depth of sortedDepths) {
    const nodesAtLevel = levels.get(depth) || [];
    const count = nodesAtLevel.length;
    if (count === 0) continue;
    
    const widths = nodesAtLevel.map((n) =>
      (n.type || "").toLowerCase() === "sensor" ? 600 : 200
    );
    const totalNodesWidth = widths.reduce((a, b) => a + b, 0);
    const baseAvailable = containerAvailWidth - horizontalMargin * 2;
    const neededForMinGaps = totalNodesWidth + (count + 1) * minGap;
    const levelAvailable = Math.max(baseAvailable, neededForMinGaps);
    const gap = (levelAvailable - totalNodesWidth) / (count + 1);
    requiredWidth = Math.max(
      requiredWidth,
      levelAvailable + horizontalMargin * 2
    );
    
    let cursor = horizontalMargin + gap;
    for (let i = 0; i < count; i++) {
      const node = nodesAtLevel[i];
      const w = widths[i];
      let centerX = cursor + w / 2;
      const topY = topMargin + depth * levelSpacing;
      
      // Check if this node is a single child of its parent
      // If so, align it directly below the parent
      if (node.parentId && depth > 0) {
        const parent = nodeMap.get(node.parentId);
        const parentChildren = childrenMap.get(node.parentId);
        
        if (parentChildren && parentChildren.length === 1 && parentChildren[0] === node.id) {
          // This is a single child - align it with parent's centerX
          const parentPos = positions.get(node.parentId);
          if (parentPos) {
            centerX = parentPos.centerX;
          }
        }
      }
      
      positions.set(node.id, { centerX, topY });
      cursor += w + gap;
    }
  }
  
  // Center single root at top center
  if (levels.has(0)) {
    const roots = levels.get(0) || [];
    if (roots.length === 1) {
      const root = roots[0];
      const prev = positions.get(root.id);
      if (prev)
        positions.set(root.id, { ...prev, centerX: requiredWidth / 2 });
    }
  }
  
  return { positions, requiredWidth };
};

TreeApp.prototype.getRenderedSize = function() {
  if (this.layoutMode === "vertical") {
    return {
      width: this.contentSize.height,
      height: this.contentSize.width
    };
  }
  return this.contentSize;
};
