import "./style.css";
const PLUGIN_PATH = "/header-hider";

const defaultHeaders = [
  "accept",
  "accept-encoding",
  "accept-language",
  "if-modified-since",
  "if-none-match",
  "priority",
  "sec-ch-ua",
  "origin",
  "connection",
  "content-length",
  "sec-ch-ua-platform",
  "user-agent",
  "sec-ch-ua-mobile",
  "sec-fetch-site",
  "sec-fetch-mode",
  "sec-fetch-dest"
];

let hiddenHeaders = [...defaultHeaders];
let isEnabled = true;
let observer = null;

const createPage = (sdk) => {
  const container = document.createElement("div");
  container.className = "header-hider";

  const header = document.createElement("h1");
  header.textContent = "Uninteresting Headers";
  container.appendChild(header);

  const description = document.createElement("p");
  description.className = "description";
  description.textContent = "Use this setting to control whether Caido automatically hides the specified HTTP headers. Headers are case insensitive.";
  container.appendChild(description);

  const toggleSection = document.createElement("div");
  toggleSection.className = "toggle-section";
  
  const toggleLabel = document.createElement("label");
  toggleLabel.className = "toggle-label";
  
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = isEnabled;
  checkbox.onchange = (e) => toggleHeaderHiding(e.target.checked);
  
  const toggleText = document.createTextNode("Hide the following headers by default:");
  toggleLabel.appendChild(checkbox);
  toggleLabel.appendChild(toggleText);
  toggleSection.appendChild(toggleLabel);
  
  container.appendChild(toggleSection);

  const headerSection = document.createElement("div");
  headerSection.className = "header-section";

  const headerList = document.createElement("div");
  headerList.className = "header-list";
  
  const selectionInfo = document.createElement("div");
  selectionInfo.className = "selection-info";
  selectionInfo.textContent = "Use Shift+Click for range selection or Ctrl/Cmd+Click for multiple selection";

  headerList.tabIndex = 0;
  
  let lastSelectedIndex = -1;

  const handleHeaderClick = (item, index, e) => {
    if (e.shiftKey && lastSelectedIndex !== -1) {
      const items = Array.from(headerList.children);
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      
      items.forEach((item, i) => {
        if (i >= start && i <= end) {
          item.classList.add('selected');
        }
      });
    } else if (e.ctrlKey || e.metaKey) {
      item.classList.toggle('selected');
      if (item.classList.contains('selected')) {
        lastSelectedIndex = index;
      }
    } else {
      Array.from(headerList.children).forEach(h => h.classList.remove('selected'));
      item.classList.add('selected');
      lastSelectedIndex = index;
    }
    
    updateSelectionCount(headerList);
  };

  // Store handleHeaderClick in the headerList element
  headerList.handleHeaderClick = handleHeaderClick;

  headerList.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      e.preventDefault();
      selectAllHeaders(headerList);
    }
  });

  const controls = document.createElement("div");
  controls.className = "header-controls";

  const removeButton = document.createElement("button");
  removeButton.textContent = "Remove Selected";
  removeButton.onclick = () => removeSelectedHeader(headerList);
  
  const clearButton = document.createElement("button");
  clearButton.textContent = "Clear All";
  clearButton.onclick = () => clearHeaders(headerList);

  const importExportControls = document.createElement("div");
  importExportControls.className = "import-export-controls";

  const importButton = document.createElement("button");
  importButton.textContent = "Import";
  importButton.onclick = () => importHeaders(headerList);

  const exportButton = document.createElement("button");
  exportButton.textContent = "Export";
  exportButton.onclick = () => exportHeaders();

  importExportControls.appendChild(importButton);
  importExportControls.appendChild(exportButton);

  controls.appendChild(removeButton);
  controls.appendChild(clearButton);
  controls.appendChild(importExportControls);

  const addSection = document.createElement("div");
  addSection.className = "add-section";

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Enter a new header";
  input.className = "header-input";

  const addButton = document.createElement("button");
  addButton.textContent = "Add";
  addButton.onclick = () => {
    addNewHeader(input.value, headerList);
    input.value = '';
  };

  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addNewHeader(input.value, headerList);
      input.value = '';
    }
  });

  addSection.appendChild(input);
  addSection.appendChild(addButton);

  headerSection.appendChild(headerList);
  headerSection.appendChild(selectionInfo);
  headerSection.appendChild(controls);
  headerSection.appendChild(addSection);
  
  container.appendChild(headerSection);

  
  updateHeaderList(headerList);

  sdk.navigation.addPage(PLUGIN_PATH, {
    body: container
  });

  initializeObserver();
};

const updateHeaderList = (headerList) => {
  if (!headerList) return;

  const handleHeaderClick = headerList.handleHeaderClick;
  if (!handleHeaderClick) return;

  headerList.innerHTML = "";
  hiddenHeaders.forEach((header, index) => {
    const item = document.createElement("div");
    item.className = "header-item";
    item.textContent = header;
    item.onclick = (e) => handleHeaderClick(item, index, e);
    headerList.appendChild(item);
  });
  
  processHeaderElements(document.body);
  updateSelectionCount(headerList);
};

const selectAllHeaders = (headerList) => {
  if (!headerList) return;
  
  Array.from(headerList.children).forEach(item => {
    item.classList.add('selected');
  });
  updateSelectionCount(headerList);
};

const updateSelectionCount = (headerList) => {
  if (!headerList) return;
  
  const selectedCount = headerList.querySelectorAll('.selected').length;
  const totalCount = headerList.children.length;
  const selectionInfo = headerList.parentElement.querySelector('.selection-info');
  
  if (!selectionInfo) return;
  
  if (selectedCount > 0) {
    selectionInfo.textContent = `${selectedCount} of ${totalCount} headers selected`;
  } else {
    selectionInfo.textContent = "Use Shift+Click for range selection or Ctrl/Cmd+Click for multiple selection";
  }
};

const importHeaders = (headerList) => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.txt';
  
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target.result;
        const newHeaders = content.split('\n')
          .map(line => line.trim().toLowerCase())
          .filter(line => line && !hiddenHeaders.includes(line));
        
        if (newHeaders.length > 0) {
          hiddenHeaders = [...hiddenHeaders, ...newHeaders];
          updateHeaderList(headerList);
          saveHeaders();
          alert(`Imported ${newHeaders.length} new headers successfully.`);
        } else {
          alert('No new headers found in the file.');
        }
      };
      reader.readAsText(file);
    }
  };
  
  input.click();
};

const exportHeaders = () => {
  const content = hiddenHeaders.join('\n');
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = 'hidden-headers.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const hideHeaderElement = (element) => {
  const headerContainer = element.closest('.cm-line');
  if (headerContainer) {
    headerContainer.style.display = 'none';
    headerContainer.dataset.headerHidden = 'true';
  }
};

const showHeaderElement = (element) => {
  const headerContainer = element.closest('.cm-line');
  if (headerContainer) {
    headerContainer.style.display = '';
    delete headerContainer.dataset.headerHidden;
  }
};

const processHeaderElements = (root) => {
  if (!root || !isEnabled) return;

  const headerElements = root.querySelectorAll('.c-lang-http-request__headerName');
  
  headerElements.forEach(element => {
    if (element.closest('.cm-line')?.dataset.headerHidden) return;

    const headerName = element.textContent.trim().toLowerCase();
    const cleanHeaderName = headerName.replace(/[:]\s*$/, '');
    
    if (hiddenHeaders.includes(cleanHeaderName)) {
      hideHeaderElement(element);
    }
  });
};

const initializeObserver = () => {
  if (observer) {
    observer.disconnect();
  }

  observer = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          processHeaderElements(node);
          setTimeout(() => processHeaderElements(node), 100);
        }
      });

      if (mutation.type === 'attributes' && mutation.target.nodeType === Node.ELEMENT_NODE) {
        processHeaderElements(mutation.target);
      }
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style']
  });

  processHeaderElements(document.body);
};

const addNewHeader = (header, headerList) => {
  const cleanHeader = header.trim().toLowerCase();
  if (cleanHeader && !hiddenHeaders.includes(cleanHeader)) {
    hiddenHeaders.push(cleanHeader);
    updateHeaderList(headerList);
    saveHeaders();
    processHeaderElements(document.body);
  }
};

const removeSelectedHeader = (headerList) => {
  if (!headerList) return;

  const selected = headerList.querySelectorAll(".selected");
  const removedHeaders = new Set();
  
  selected.forEach(item => {
    const headerName = item.textContent.toLowerCase();
    hiddenHeaders = hiddenHeaders.filter(h => h !== headerName);
    removedHeaders.add(headerName);
  });

  updateHeaderList(headerList);
  saveHeaders();

  document.querySelectorAll('.c-lang-http-request__headerName').forEach(element => {
    const headerName = element.textContent.trim().toLowerCase().replace(/[:]\s*$/, '');
    if (removedHeaders.has(headerName)) {
      showHeaderElement(element);
    }
  });
};

const clearHeaders = (headerList) => {
  hiddenHeaders = [];
  updateHeaderList(headerList);
  saveHeaders();

  document.querySelectorAll('[data-header-hidden]').forEach(element => {
    element.style.display = '';
    delete element.dataset.headerHidden;
  });
};

const toggleHeaderHiding = (enabled) => {
  isEnabled = enabled;
  if (enabled) {
    processHeaderElements(document.body);
  } else {
    document.querySelectorAll('[data-header-hidden]').forEach(element => {
      element.style.display = '';
      delete element.dataset.headerHidden;
    });
  }
  saveHeaders();
};

const saveHeaders = () => {
  localStorage.setItem('caido-header-hider-headers', JSON.stringify(hiddenHeaders));
  localStorage.setItem('caido-header-hider-enabled', JSON.stringify(isEnabled));
};

const loadSettings = () => {
  try {
    const savedHeaders = localStorage.getItem('caido-header-hider-headers');
    const savedEnabled = localStorage.getItem('caido-header-hider-enabled');
    
    if (savedHeaders) {
      hiddenHeaders = JSON.parse(savedHeaders);
    }
    
    if (savedEnabled !== null) {
      isEnabled = JSON.parse(savedEnabled);
    }
  } catch (e) {
    console.error('Error loading header hider settings:', e);
  }
};

export const init = (sdk) => {
  loadSettings();
  createPage(sdk);
  sdk.sidebar.registerItem("Header Hider", PLUGIN_PATH, {
    icon: "fas fa-eye-slash",
  });
};
