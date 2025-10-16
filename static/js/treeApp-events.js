// treeApp-events.js
// Event handlers for TreeApp

// Minimal cookie reader for CSRF token
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

TreeApp.prototype.handleFileChange = function(e) {
  this.selectedFile = e.target.files[0];
  const uploadBtn = document.getElementById('upload-btn');
  uploadBtn.disabled = !this.selectedFile;
};

// Load tree from database (auto-called on page load for both superuser and normal users)
TreeApp.prototype.loadTreeFromDatabase = async function() {
  try {
    this.uploadLoading = true;
    this.uploadError = null;
    this.render();
    
    const res = await fetch('/api/tree/data/', {
      method: 'GET',
      credentials: 'same-origin'
    });
    
    if (!res.ok) {
      const t = await res.text().catch(() => res.statusText);
      throw new Error(`Status ${res.status} — ${t}`);
    }
    
    const rawText = await res.text();
    const safeText = rawText.replace(/\bNaN\b/g, 'null');
    const json = JSON.parse(safeText);
    
    // Normalize the data (handles hierarchical tree structure)
    const normalized = normalizeData(json);
    
    if (!normalized || Object.keys(normalized).length === 0) {
      throw new Error('No tree data in database. Superuser must upload Excel file first.');
    }
    
    // Set tree data and reset state
    this.data = normalized;
    this.expandedSet = new Set();
    this.activeExpandedNode = null;
    this.specialParents = new Set();
    this.search = "";
    this.spreadNodeId = null;
    this.layoutMode = "horizontal";
    
    this.uploadLoading = false;
    this.render();
    this.computeLayout();
    
    console.log('✅ Tree loaded from database successfully');
  } catch (err) {
    console.error('Failed to load tree from database:', err);
    this.uploadError = err.message || 'No data in database. Superuser must upload Excel file first.';
    this.uploadLoading = false;
    this.render();
  }
};

TreeApp.prototype.handleUpload = async function() {
  if (!this.selectedFile) return;
  
  // Check if user is superuser (read from template)
  const isSuperuser = document.querySelector('[data-is-superuser]')?.dataset?.isSuperuser === 'true';
  const endpoint = isSuperuser ? '/api/tree/upload-permanent/' : '/api/tree/upload/';
  
  // Show confirmation for superuser permanent upload
  if (isSuperuser) {
    if (!confirm('⚠️ This will PERMANENTLY save data to the database.\n\nThis can only be done ONCE.\n\nContinue?')) {
      return;
    }
  }
  
  try {
    this.uploadLoading = true;
    this.uploadError = null;
    this.render();
    
    const formData = new FormData();
    formData.append('file', this.selectedFile);
    const csrftoken = getCookie('csrftoken');

    const res = await fetch(endpoint, {
      method: 'POST',
      body: formData,
      credentials: 'same-origin',
      headers: {
        'X-CSRFToken': csrftoken || ''
      }
    });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(errorData.error || `Status ${res.status}`);
    }
    
    const rawText = await res.text();
    const safeText = rawText.replace(/\bNaN\b/g, 'null');
    const json = JSON.parse(safeText);
    
    // For superuser permanent upload, reload from database
    if (isSuperuser) {
      alert('✅ Data saved to database successfully!\n\nTree will now reload from database.');
      await this.loadTreeFromDatabase();
      return;
    }
    
    // For normal users, show the uploaded tree temporarily (view-only)
    const normalized = normalizeData(json);
    
    if (!normalized || Object.keys(normalized).length === 0) {
      throw new Error('Empty tree data received from uploaded file');
    }
    
    // Reset states for new tree
    this.data = normalized;
    this.expandedSet = new Set();
    this.activeExpandedNode = null;
    this.specialParents = new Set();
    this.search = "";
    this.spreadNodeId = null;
    this.layoutMode = "horizontal";
    
    this.uploadLoading = false;
    this.render();
    this.computeLayout();
    
    console.log('✅ Tree uploaded for viewing (not saved to database)');
  } catch (err) {
    console.error('Failed to upload tree data:', err);
    this.uploadError = err.message || 'Unknown error while uploading data';
    this.uploadLoading = false;
    this.render();
  }
};

TreeApp.prototype.onExpandNext = function() {
  const levels = buildVisibleLevels(this.data, this.expandedSet, this.search);
  if (!levels || levels.length === 0) return;
  
  const lastLevel = levels[levels.length - 1];
  const idsToExpand = lastLevel
    .filter((n) => n.children && Object.keys(n.children).length > 0)
    .map((n) => n.id);
  
  if (idsToExpand.length === 0) return;
  
  idsToExpand.forEach((id) => this.expandedSet.add(id));
  this.specialParents = new Set(idsToExpand);
  this.activeExpandedNode = null;
  
  this.render();
  this.computeLayout();
};

TreeApp.prototype.onCollapsePrev = function() {
  const levels = buildVisibleLevels(this.data, this.expandedSet, this.search);
  if (!levels || levels.length <= 1) return;
  
  const parentLevelIndex = levels.length - 2;
  const parentLevel = levels[parentLevelIndex];
  
  for (const node of parentLevel) {
    this.expandedSet.delete(node.id);
    collapseChildrenRecursivelyInData(this.data, node.id, this.expandedSet);
  }
  
  // Determine parents of these parent-level nodes (one level up)
  const parents = new Set();
  for (const node of parentLevel) {
    const path = findPathToNode(this.data, node.id) || [];
    if (path && path.length >= 2) {
      const parentNode = path[path.length - 2];
      if (parentNode && parentNode.id) parents.add(parentNode.id);
    }
  }
  
  this.specialParents = parents;
  
  const firstParent = parents.values().next();
  if (!firstParent.done) {
    this.activeExpandedNode = firstParent.value;
  } else {
    this.activeExpandedNode = null;
  }
  
  this.render();
  this.computeLayout();
};

TreeApp.prototype.onExpandToggle = function(node) {
  const nodeId = node.id;
  const wasExpanded = this.expandedSet.has(nodeId);
  
  if (wasExpanded) {
    // Store previously expanded descendants for restore later
    const allDesc = this.collectDescendantIds(nodeId);
    const expandedDesc = allDesc.filter((id) => this.expandedSet.has(id));
    if (expandedDesc.length > 0) {
      this.prevExpandedByNode.set(nodeId, new Set(expandedDesc));
    }
    
    // Collapse node and all descendants
    this.expandedSet.delete(nodeId);
    this.collapseChildrenRecursively(nodeId);
    
    // Update active highlight to parent if any
    const path = findPathToNode(this.data, nodeId) || [];
    if (path && path.length >= 2) {
      const parentNode = path[path.length - 2];
      this.activeExpandedNode = parentNode ? parentNode.id : null;
    } else if (this.activeExpandedNode === nodeId) {
      this.activeExpandedNode = null;
    }
  } else {
    // Expand node and restore previously expanded descendants if present
    this.expandedSet.add(nodeId);
    const saved = this.prevExpandedByNode.get(nodeId);
    if (saved && saved.size > 0) {
      for (const id of saved) this.expandedSet.add(id);
      this.prevExpandedByNode.delete(nodeId);
    }
    this.activeExpandedNode = nodeId;
  }
  
  this.render();
  this.computeLayout();
};

TreeApp.prototype.onSpreadToggle = function(node) {
  if (this.spreadNodeId === node.id) {
    this.spreadNodeId = null;
    setTimeout(() => {
      const prev = this.prevScroll || { left: 0, top: 0 };
      this.containerEl.scrollTo({
        left: prev.left,
        top: prev.top,
        behavior: 'smooth',
      });
    }, 120);
  } else {
    this.prevScroll = {
      left: this.containerEl.scrollLeft,
      top: this.containerEl.scrollTop,
    };
    this.spreadNodeId = node.id;
    
    // Focus on spread node after layout
    setTimeout(() => this.focusOnSpreadNode(), 120);
  }
  
  this.render();
  this.computeLayout();
};

TreeApp.prototype.focusOnSpreadNode = function() {
  if (!this.spreadNodeId || !this.containerEl) return;
  
  const nodeEl = this.containerEl.querySelector(
    `[data-node-id="${this.spreadNodeId}"]`
  );
  if (!nodeEl) return;
  
  const containerRect = this.containerEl.getBoundingClientRect();
  const elRect = nodeEl.getBoundingClientRect();
  
  const elLeftWithinContent =
    elRect.left - containerRect.left + this.containerEl.scrollLeft;
  const elTopWithinContent =
    elRect.top - containerRect.top + this.containerEl.scrollTop;
  
  const desiredLeftWithinContent = LEFT_MARGIN;
  const desiredTopWithinContent = Math.max(
    0,
    elTopWithinContent - this.containerEl.clientHeight / 2 + elRect.height / 2
  );
  
  const newScrollLeft = Math.max(
    0,
    Math.round(elLeftWithinContent - desiredLeftWithinContent)
  );
  const newScrollTop = Math.max(0, Math.round(desiredTopWithinContent));
  
  this.containerEl.scrollTo({
    left: newScrollLeft,
    top: newScrollTop,
    behavior: 'smooth',
  });
};
