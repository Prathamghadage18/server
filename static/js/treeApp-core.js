// treeApp-core.js
// Core TreeApp class with state management

const NODE_HEIGHT = 160;
const V_GAP = 15;
const X_SPACING = 220;
const LEFT_MARGIN = 60;
const RIGHT_PADDING = 160;
const NINTH_LEVEL_X_SPACING = 320;

class TreeApp {
  constructor() {
    // State
    this.data = null;
    this.expandedSet = new Set();
    this.activeExpandedNode = null;
    this.specialParents = new Set();
    this.search = "";
    this.spreadNodeId = null;
    this.layoutMode = "horizontal";
    this.uploadLoading = false;
    this.uploadError = null;
    this.selectedFile = null;
    this.sidebarClosed = false;
    this.isRendering = false;
    
    // Layout state
    this.treeLayout = {};
    this.contentSize = { width: 1000, height: 800 };
    this.paths = [];
    this.prevExpandedByNode = new Map();
    this.prevScroll = { left: 0, top: 0 };
    this.verticalLayoutComputed = null;
    
    // DOM elements
    this.containerEl = null;
    this.svgEl = null;
    this.treeContainerEl = null;
    this.mutationObserver = null;
  }
  
  init() {
    // Prevent multiple initializations
    if (this.initialized) return;
    this.initialized = true;
    
    // Get DOM elements
    this.containerEl = document.getElementById('canvas-container');
    this.svgEl = document.getElementById('connector-svg');
    this.treeContainerEl = document.getElementById('tree-container');
    
    // Setup event listeners
    this.setupEventListeners();
    this.setupObservers();
    
    // Initial render
    this.render();
    
    // Auto-load tree from database on page load (for both superuser and normal users)
    this.loadTreeFromDatabase();
  }
  
  setupEventListeners() {
    document.getElementById('file-input').addEventListener('change', (e) => this.handleFileChange(e));
    document.getElementById('upload-btn').addEventListener('click', () => this.handleUpload());
    document.getElementById('expand-next-btn').addEventListener('click', () => this.onExpandNext());
    document.getElementById('collapse-prev-btn').addEventListener('click', () => this.onCollapsePrev());
    document.getElementById('layout-toggle-btn').addEventListener('click', () => this.toggleLayoutMode());
    document.getElementById('sidebar-close-btn').addEventListener('click', () => this.toggleSidebar());
    document.getElementById('sidebar-open-btn').addEventListener('click', () => this.toggleSidebar());
    document.getElementById('search-input').addEventListener('input', (e) => {
      this.search = e.target.value;
      this.render();
      if (this.data) {
        this.computeLayout();
      }
    });
  }
  
  setupObservers() {
    let raf = null;
    const onScroll = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => this.computePaths());
    };
    const onResize = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => this.computePaths());
    };
    
    if (this.containerEl) {
      this.containerEl.addEventListener('scroll', onScroll, { passive: true });
      const ro = new ResizeObserver(onResize);
      ro.observe(this.containerEl);
      
      // Store mutation observer reference
      this.mutationObserver = new MutationObserver((mutations) => {
        // Ignore mutations during rendering
        if (this.isRendering) return;
        
        let shouldUpdate = false;
        mutations.forEach((mutation) => {
          if (
            mutation.type === 'attributes' &&
            (mutation.attributeName === 'style' || mutation.attributeName === 'class')
          ) {
            shouldUpdate = true;
          }
        });
        if (shouldUpdate) {
          onResize();
        }
      });
      this.mutationObserver.observe(this.containerEl, {
        childList: false, // Don't observe child list changes to avoid triggering during rendering
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class'],
      });
      
      window.addEventListener('resize', onResize);
    }
  }
  
  render() {
    this.renderSidebar();
    this.renderCanvas();
  }
  
  renderSidebar() {
    // Update sidebar visibility
    const sidebar = document.getElementById('sidebar');
    const openBtn = document.getElementById('sidebar-open-btn');
    if (this.sidebarClosed) {
      sidebar.style.display = 'none';
      openBtn.style.display = 'block';
    } else {
      sidebar.style.display = 'flex';
      openBtn.style.display = 'none';
    }
    
    // Update stats
    if (this.data) {
      const stats = countSensors(this.data);
      document.getElementById('stat-total').textContent = stats.total;
      document.getElementById('stat-online').textContent = stats.online;
      document.getElementById('stat-warning').textContent = stats.warning;
      document.getElementById('stat-offline').textContent = stats.offline;
    }
    
    // Update buttons state
    const levels = buildVisibleLevels(this.data, this.expandedSet, this.search);
    const canExpandNext = levels && levels.length > 0 && levels[levels.length - 1].some(
      (n) => n.children && Object.keys(n.children).length > 0
    );
    const canCollapsePrev = levels && levels.length > 1;
    
    document.getElementById('expand-next-btn').disabled = !canExpandNext;
    document.getElementById('collapse-prev-btn').disabled = !canCollapsePrev;
  }
  
  renderCanvas() {
    // Update breadcrumb
    const breadcrumbText = this.getBreadcrumbText();
    document.getElementById('breadcrumb-text').textContent = breadcrumbText;
    
    // Update layout mode button
    const layoutBtn = document.getElementById('layout-toggle-btn');
    layoutBtn.textContent = this.layoutMode === 'horizontal' ? 'Vertical' : 'Horizontal';
    document.getElementById('layout-mode-text').textContent = this.layoutMode;
    
    // Show loading or error states
    const loadingEl = document.getElementById('loading-message');
    const errorEl = document.getElementById('error-message');
    const noDataEl = document.getElementById('no-data-message');
    const canvasContent = document.getElementById('canvas-content');
    
    // Manage loading state
    if (this.uploadLoading) {
      loadingEl.style.display = 'flex';
      loadingEl.classList.add('d-flex');
    } else {
      loadingEl.style.display = 'none';
      loadingEl.classList.remove('d-flex');
    }
    
    // Manage error state
    if (this.uploadError) {
      errorEl.style.display = 'flex';
      errorEl.classList.add('d-flex');
      document.getElementById('error-text').textContent = this.uploadError;
    } else {
      errorEl.style.display = 'none';
      errorEl.classList.remove('d-flex');
    }
    
    // Manage no-data and canvas states
    if (!this.uploadLoading && !this.uploadError) {
      if (this.data) {
        noDataEl.style.display = 'none';
        noDataEl.classList.remove('d-flex');
        canvasContent.style.display = 'block';
      } else {
        noDataEl.style.display = 'flex';
        noDataEl.classList.add('d-flex');
        canvasContent.style.display = 'none';
      }
    } else {
      noDataEl.style.display = 'none';
      noDataEl.classList.remove('d-flex');
      canvasContent.style.display = 'none';
    }
  }
  
  getBreadcrumbText() {
    if (this.spreadNodeId) {
      const path = findPathToNode(this.data, this.spreadNodeId);
      if (path && path.length) return path.map((n) => n.name).join(' › ');
      return 'Focused subtree';
    }
    if (this.activeExpandedNode) {
      const p = findPathToNode(this.data, this.activeExpandedNode);
      return p.map((n) => n.name).join(' › ');
    }
    return 'Click an expand (+) button to highlight a path';
  }
  
  collectDescendantIds(nodeId) {
    const node = findNodeById(this.data, nodeId);
    const ids = [];
    const walk = (n) => {
      if (!n || !n.children) return;
      for (const c of Object.values(n.children)) {
        ids.push(c.id);
        walk(c);
      }
    };
    walk(node);
    return ids;
  }
  
  collapseChildrenRecursively(nodeId) {
    const node = findNodeById(this.data, nodeId);
    if (!node || !node.children) return;
    for (const child of Object.values(node.children)) {
      if (!child || !child.id) continue;
      this.expandedSet.delete(child.id);
      this.collapseChildrenRecursively(child.id);
    }
  }
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  toggleSidebar() {
    this.sidebarClosed = !this.sidebarClosed;
    this.render();
  }
  
  toggleLayoutMode() {
    this.layoutMode = this.layoutMode === 'horizontal' ? 'vertical' : 'horizontal';
    this.render();
    this.computeLayout();
    
    // Center horizontally when switching to vertical mode
    if (this.layoutMode === 'vertical' && this.containerEl) {
      setTimeout(() => {
        const el = this.containerEl;
        const centerX = Math.max(0, (el.scrollWidth - el.clientWidth) / 2);
        el.scrollTo({ left: centerX, top: 0, behavior: 'auto' });
      }, 100);
    }
  }
}
