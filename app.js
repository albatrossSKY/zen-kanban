/**
 * Zen Kanban - Core Logic
 * Pure HTML5, CSS3 and ES6 JavaScript. Zero dependencies.
 */

// --- Default Demo Data ---
const DEFAULT_BOARD = {
  columns: [
    { id: 'col-backlog', title: 'Backlog' },
    { id: 'col-todo', title: 'To Do' },
    { id: 'col-progress', title: 'In Progress' },
    { id: 'col-done', title: 'Completed' }
  ],
  tasks: [
    {
      id: 'task-welcome',
      columnId: 'col-backlog',
      title: 'Welcome to Zen Kanban! 🚀',
      description: 'A premium, local-first Kanban board built with native HTML5 APIs. Drag me around columns or inside this list to reorder!',
      priority: 'medium',
      dueDate: '',
      tags: ['guide', 'local-first'],
      checklist: [
        { id: 'sub-1', text: 'Drag this card to "To Do"', done: false },
        { id: 'sub-2', text: 'Double click column header to rename', done: false }
      ]
    },
    {
      id: 'task-details',
      columnId: 'col-todo',
      title: 'Inspect task detail & subtasks',
      description: 'Click the pencil icon on the top-right of this card to edit priority, tags, deadlines, or check off subtasks.',
      priority: 'high',
      dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0], // 2 days from now
      tags: ['features'],
      checklist: [
        { id: 'sub-3', text: 'View due date indicators', done: true },
        { id: 'sub-4', text: 'Edit subtasks in the modal', done: false },
        { id: 'sub-5', text: 'Observe progress bar fill up', done: false }
      ]
    },
    {
      id: 'task-themes',
      columnId: 'col-progress',
      title: 'Try out multiple themes 🎨',
      description: 'Use the theme selector at the top-right to alternate between Midnight Glass, Emerald Oasis, Cyberpunk Neon, and Sunset Glow.',
      priority: 'low',
      dueDate: '',
      tags: ['styling'],
      checklist: []
    },
    {
      id: 'task-confetti',
      columnId: 'col-done',
      title: 'Move tasks here for Confetti! 🎉',
      description: 'Dragging any task into this column fires a custom CSS-animated particle confetti shower. Try dragging another card here now!',
      priority: 'urgent',
      dueDate: new Date(Date.now() - 86400000).toISOString().split('T')[0], // Yesterday (overdue but done)
      tags: ['delight', 'interactive'],
      checklist: [
        { id: 'sub-6', text: 'Verify particle engine', done: true }
      ]
    }
  ]
};

// --- Application State ---
let boardState = { columns: [], tasks: [] };
let undoStack = []; // Stores JSON strings of boardState for rollback
let activeDraggingTaskId = null;
let currentModalSubtasks = []; // Temporary holding state for modal subtasks editing

// --- DOM Cache ---
const kanbanBoard = document.getElementById('kanbanBoard');
const themeSelect = document.getElementById('themeSelect');
const toggleStatsBtn = document.getElementById('toggleStatsBtn');
const statsDashboard = document.getElementById('statsDashboard');
const addColumnBtn = document.getElementById('addColumnBtn');
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const filterPriority = document.getElementById('filterPriority');
const filterDueDate = document.getElementById('filterDueDate');
const filterTag = document.getElementById('filterTag');

// Utility buttons
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const resetBtn = document.getElementById('resetBtn');

// Modals
const taskModal = document.getElementById('taskModal');
const taskForm = document.getElementById('taskForm');
const closeTaskModal = document.getElementById('closeTaskModal');
const cancelTaskBtn = document.getElementById('cancelTaskBtn');
const addSubtaskBtn = document.getElementById('addSubtaskBtn');
const newSubtaskInput = document.getElementById('newSubtaskInput');
const checklistItemsList = document.getElementById('checklistItemsList');
const tagsPreview = document.getElementById('tagsPreview');

const columnModal = document.getElementById('columnModal');
const columnForm = document.getElementById('columnForm');
const closeColumnModal = document.getElementById('closeColumnModal');
const cancelColumnBtn = document.getElementById('cancelColumnBtn');

const importModal = document.getElementById('importModal');
const closeImportModal = document.getElementById('closeImportModal');
const cancelImportBtn = document.getElementById('cancelImportBtn');
const submitImportBtn = document.getElementById('submitImportBtn');
const importJsonArea = document.getElementById('importJsonArea');

const toastContainer = document.getElementById('toastContainer');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  loadState();
  initTheme();
  setupEventListeners();
  renderBoard();
});

// --- State Management ---
function saveState() {
  localStorage.setItem('zen_kanban_board', JSON.stringify(boardState));
  updateStats();
  updateTagFilterDropdown();
}

function loadState() {
  const localData = localStorage.getItem('zen_kanban_board');
  if (localData) {
    try {
      boardState = JSON.parse(localData);
      // Data sanity migration check
      if (!boardState.columns || !boardState.tasks) {
        throw new Error('Malformed state');
      }
    } catch (e) {
      console.error('Failed parsing localStorage, resetting to default', e);
      boardState = JSON.parse(JSON.stringify(DEFAULT_BOARD));
      saveState();
    }
  } else {
    boardState = JSON.parse(JSON.stringify(DEFAULT_BOARD));
    saveState();
  }
}

function pushToUndo() {
  if (undoStack.length >= 10) {
    undoStack.shift(); // Keep limit to 10 entries
  }
  undoStack.push(JSON.stringify(boardState));
}

function triggerUndo() {
  if (undoStack.length === 0) return;
  const prevState = undoStack.pop();
  boardState = JSON.parse(prevState);
  saveState();
  renderBoard();
  showToast('Action undone!', null);
}

// --- Theme Controller ---
function initTheme() {
  const savedTheme = localStorage.getItem('zen_kanban_theme') || 'theme-midnight';
  document.body.className = savedTheme;
  themeSelect.value = savedTheme;
  
  themeSelect.addEventListener('change', (e) => {
    document.body.className = e.target.value;
    localStorage.setItem('zen_kanban_theme', e.target.value);
    showToast(`Switched theme to ${e.target.options[e.target.selectedIndex].text}`, null);
  });
}

// --- Setup Interactions ---
function setupEventListeners() {
  // Stats Toggle
  toggleStatsBtn.addEventListener('click', () => {
    statsDashboard.classList.toggle('collapsed');
  });

  // Add Column
  addColumnBtn.addEventListener('click', () => {
    openColumnModal();
  });

  // Search and Filtering
  searchInput.addEventListener('input', () => {
    clearSearchBtn.style.display = searchInput.value ? 'block' : 'none';
    filterTasks();
  });
  
  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearSearchBtn.style.display = 'none';
    filterTasks();
  });

  filterPriority.addEventListener('change', filterTasks);
  filterDueDate.addEventListener('change', filterTasks);
  filterTag.addEventListener('change', filterTasks);

  // Modal Closures
  closeTaskModal.addEventListener('click', () => closeOverlay(taskModal));
  cancelTaskBtn.addEventListener('click', () => closeOverlay(taskModal));
  closeColumnModal.addEventListener('click', () => closeOverlay(columnModal));
  cancelColumnBtn.addEventListener('click', () => closeOverlay(columnModal));
  closeImportModal.addEventListener('click', () => closeOverlay(importModal));
  cancelImportBtn.addEventListener('click', () => closeOverlay(importModal));

  // Modals Save Handlers
  taskForm.addEventListener('submit', handleTaskFormSubmit);
  columnForm.addEventListener('submit', handleColumnFormSubmit);
  
  // Subtasks modal buttons
  addSubtaskBtn.addEventListener('click', handleModalAddSubtask);
  newSubtaskInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleModalAddSubtask();
    }
  });

  // Utility Actions
  exportBtn.addEventListener('click', handleExport);
  importBtn.addEventListener('click', () => openOverlay(importModal));
  submitImportBtn.addEventListener('click', handleImportSubmit);
  resetBtn.addEventListener('click', handleResetBoard);

  // Close modals on clicking overlay background
  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      closeOverlay(e.target);
    }
  });
}

// --- Render Operations ---
function renderBoard() {
  kanbanBoard.innerHTML = '';
  
  if (boardState.columns.length === 0) {
    kanbanBoard.innerHTML = `
      <div class="board-empty-state">
        <p>Your board has no columns yet. Create one to get started!</p>
        <button onclick="openColumnModal()" class="btn btn-primary">Add First Column</button>
      </div>
    `;
    updateStats();
    return;
  }

  boardState.columns.forEach(column => {
    const colElement = document.createElement('div');
    colElement.className = 'board-column';
    colElement.dataset.colId = column.id;
    
    // Column tasks
    const colTasks = boardState.tasks.filter(t => t.columnId === column.id);

    colElement.innerHTML = `
      <div class="column-header" draggable="true" data-header-col-id="${column.id}">
        <div class="column-title-wrapper">
          <span class="column-title" title="Double click to rename">${escapeHtml(column.title)}</span>
          <span class="column-count">${colTasks.length}</span>
        </div>
        <div class="column-actions">
          <button class="column-action-btn edit-col-btn" title="Rename Column">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          </button>
          <button class="column-action-btn delete-col-btn" title="Delete Column">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
      <div class="tasks-container" data-col-container-id="${column.id}">
        <!-- Tasks render inside here -->
      </div>
      <div class="column-footer">
        <button class="btn btn-add-task" data-add-to-col-id="${column.id}">+ Add Task</button>
      </div>
    `;

    const tasksContainer = colElement.querySelector('.tasks-container');
    
    colTasks.forEach(task => {
      const taskCard = createTaskCard(task);
      tasksContainer.appendChild(taskCard);
    });

    // Column Drag & Drop and Double Click Listeners
    setupColumnDragAndDrop(colElement, tasksContainer);
    setupColumnHeaderDoubleClicks(colElement);

    // Edit/Delete Column actions
    colElement.querySelector('.edit-col-btn').addEventListener('click', () => openColumnModal(column.id));
    colElement.querySelector('.delete-col-btn').addEventListener('click', () => handleDeleteColumn(column.id));
    
    // Add task click
    colElement.querySelector('.btn-add-task').addEventListener('click', () => openTaskModal(null, column.id));

    kanbanBoard.appendChild(colElement);
  });

  // Re-run search/filtering on render to preserve filter states
  filterTasks();
  updateStats();
}

function createTaskCard(task) {
  const card = document.createElement('div');
  card.className = 'task-card';
  card.draggable = true;
  card.dataset.taskId = task.id;

  // Priority indicator logic
  const priorityText = task.priority.charAt(0).toUpperCase() + task.priority.slice(1);
  
  // Checklist math
  const subtasksCount = task.checklist ? task.checklist.length : 0;
  const completedCount = task.checklist ? task.checklist.filter(s => s.done).length : 0;
  const percentComplete = subtasksCount > 0 ? Math.round((completedCount / subtasksCount) * 100) : 0;

  // Tags compilation
  const tagsHtml = task.tags && task.tags.length 
    ? task.tags.map(tag => `<span class="tag-pill">${escapeHtml(tag)}</span>`).join('')
    : '';

  // Due Date compiling
  let dueHtml = '';
  if (task.dueDate) {
    const todayStr = new Date().toISOString().split('T')[0];
    const isOverdue = task.dueDate < todayStr && task.columnId !== getFinalColumnId();
    const isDueToday = task.dueDate === todayStr && task.columnId !== getFinalColumnId();
    
    let dueClass = '';
    let iconColor = 'currentColor';
    if (isOverdue) {
      dueClass = 'overdue';
      iconColor = 'var(--danger)';
    } else if (isDueToday) {
      dueClass = 'due-today';
      iconColor = 'var(--warning)';
    }
    
    dueHtml = `
      <div class="due-badge ${dueClass}">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        <span>${formatDateString(task.dueDate)}</span>
      </div>
    `;
  }

  // Checklist indicator status
  const checklistHtml = subtasksCount > 0 
    ? `
      <div class="checklist-badge" title="${completedCount}/${subtasksCount} tasks completed">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
        </svg>
        <span>${completedCount}/${subtasksCount}</span>
      </div>
    `
    : '';

  // Progress Bar
  const progressContainerHtml = subtasksCount > 0
    ? `
      <div class="card-progress-container">
        <div class="card-progress-bar ${percentComplete === 100 ? 'done' : ''}" style="width: ${percentComplete}%"></div>
      </div>
    `
    : '';

  card.innerHTML = `
    <div class="card-top">
      <span class="priority-badge p-${task.priority}">${priorityText}</span>
      <div class="card-actions">
        <button class="card-btn edit-task-btn" title="Edit Task">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        </button>
        <button class="card-btn delete-btn" title="Delete Task">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    </div>
    <div class="card-title">${escapeHtml(task.title)}</div>
    ${task.description ? `<div class="card-desc">${escapeHtml(task.description)}</div>` : ''}
    ${tagsHtml ? `<div class="card-tags">${tagsHtml}</div>` : ''}
    ${dueHtml || checklistHtml ? `
      <div class="card-meta">
        <div class="card-meta-left">
          ${dueHtml}
          ${checklistHtml}
        </div>
      </div>
    ` : ''}
    ${progressContainerHtml}
  `;

  // Attach card event listeners
  card.addEventListener('dragstart', handleTaskDragStart);
  card.addEventListener('dragend', handleTaskDragEnd);
  
  card.querySelector('.edit-task-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    openTaskModal(task.id);
  });
  card.querySelector('.delete-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    handleDeleteTask(task.id);
  });

  // Double click task card opens details
  card.addEventListener('dblclick', () => {
    openTaskModal(task.id);
  });

  return card;
}

// --- HTML5 Native Drag & Drop Implementation ---

function handleTaskDragStart(e) {
  activeDraggingTaskId = this.dataset.taskId;
  this.classList.add('dragging');
  e.dataTransfer.setData('text/plain', activeDraggingTaskId);
  e.dataTransfer.effectAllowed = 'move';
}

function handleTaskDragEnd(e) {
  this.classList.remove('dragging');
  activeDraggingTaskId = null;
  
  // Clean all columns drop indicators
  document.querySelectorAll('.drop-indicator').forEach(el => el.remove());
  document.querySelectorAll('.board-column').forEach(col => col.classList.remove('drag-over'));
}

function setupColumnDragAndDrop(colElement, tasksContainer) {
  // Handle Column Reordering Drag & Drop (Optional Header Drag)
  const header = colElement.querySelector('.column-header');
  
  header.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('column/id', colElement.dataset.colId);
    e.dataTransfer.effectAllowed = 'move';
    colElement.style.opacity = '0.5';
  });

  header.addEventListener('dragend', () => {
    colElement.style.opacity = '1';
    document.querySelectorAll('.board-column').forEach(col => col.classList.remove('drag-over'));
  });

  // Column drop zone event listeners
  colElement.addEventListener('dragover', (e) => {
    e.preventDefault();
    colElement.classList.add('drag-over');

    // Differentiate between task drag and column drag
    if (activeDraggingTaskId) {
      // Task drag logic
      const afterElement = getDragAfterElement(tasksContainer, e.clientY);
      const existingIndicator = tasksContainer.querySelector('.drop-indicator');
      
      if (!existingIndicator) {
        const indicator = document.createElement('div');
        indicator.className = 'drop-indicator';
        if (afterElement == null) {
          tasksContainer.appendChild(indicator);
        } else {
          tasksContainer.insertBefore(indicator, afterElement);
        }
      } else {
        // Relocate existing indicator
        if (afterElement == null) {
          tasksContainer.appendChild(existingIndicator);
        } else if (afterElement !== existingIndicator.nextElementSibling) {
          tasksContainer.insertBefore(existingIndicator, afterElement);
        }
      }
    } else {
      // Column drag logic (horizontal indicator/drop location)
      e.dataTransfer.dropEffect = 'move';
    }
  });

  colElement.addEventListener('dragleave', (e) => {
    // Only remove class if we leave the actual column boundaries
    if (!colElement.contains(e.relatedTarget)) {
      colElement.classList.remove('drag-over');
      const indicator = tasksContainer.querySelector('.drop-indicator');
      if (indicator) indicator.remove();
    }
  });

  colElement.addEventListener('drop', (e) => {
    e.preventDefault();
    colElement.classList.remove('drag-over');
    
    // Check if dragging column
    const colDragId = e.dataTransfer.getData('column/id');
    if (colDragId) {
      handleColumnDrop(colDragId, colElement.dataset.colId);
      return;
    }

    // Task drop logic
    const taskId = e.dataTransfer.getData('text/plain') || activeDraggingTaskId;
    if (!taskId) return;

    const task = boardState.tasks.find(t => t.id === taskId);
    if (!task) return;

    const destinationColId = colElement.dataset.colId;
    const indicator = tasksContainer.querySelector('.drop-indicator');
    
    // Determine target index inside destination list
    const visibleCards = [...tasksContainer.querySelectorAll('.task-card:not(.dragging)')];
    let targetIndex = visibleCards.length;

    if (indicator) {
      const idx = [...tasksContainer.children].indexOf(indicator);
      if (idx !== -1) {
        targetIndex = idx;
      }
      indicator.remove();
    }

    // Save previous state for Undo
    pushToUndo();

    // Check if task moved to final column
    const prevColId = task.columnId;
    const finalColId = getFinalColumnId();
    const isNowCompleted = destinationColId === finalColId && prevColId !== finalColId;

    // Remove from array and insert in target order
    const taskIdx = boardState.tasks.findIndex(t => t.id === taskId);
    boardState.tasks.splice(taskIdx, 1);
    
    // Update task's column ID
    task.columnId = destinationColId;

    // Get current tasks in destination column
    const destTasks = boardState.tasks.filter(t => t.columnId === destinationColId);
    
    // Insert relative to destination column tasks positioning
    const otherColTasks = boardState.tasks.filter(t => t.columnId !== destinationColId);
    destTasks.splice(targetIndex, 0, task);
    
    // Reassemble full tasks array
    boardState.tasks = [...otherColTasks, ...destTasks];
    
    saveState();
    renderBoard();

    // Fire Confetti if task just entered final column
    if (isNowCompleted) {
      triggerConfetti();
      showToast(`Completed task! 🎉 "${task.title}"`, triggerUndo);
    } else {
      showToast(`Moved task to "${boardState.columns.find(c => c.id === destinationColId).title}"`, triggerUndo);
    }
  });
}

// Find placement node during dragover inside containers
function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.task-card:not(.dragging)')];

  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// Handle column sorting (horizontal rearrange)
function handleColumnDrop(draggedColId, targetColId) {
  if (draggedColId === targetColId) return;

  pushToUndo();
  
  const fromIdx = boardState.columns.findIndex(c => c.id === draggedColId);
  const toIdx = boardState.columns.findIndex(c => c.id === targetColId);

  const [removed] = boardState.columns.splice(fromIdx, 1);
  boardState.columns.splice(toIdx, 0, removed);

  saveState();
  renderBoard();
  showToast(`Rearranged columns`, triggerUndo);
}

function setupColumnHeaderDoubleClicks(colElement) {
  const titleSpan = colElement.querySelector('.column-title');
  titleSpan.addEventListener('dblclick', () => {
    openColumnModal(colElement.dataset.colId);
  });
}

function getFinalColumnId() {
  if (boardState.columns.length === 0) return null;
  return boardState.columns[boardState.columns.length - 1].id;
}

// --- Task Modal Operations ---

function openTaskModal(taskId = null, columnId = null) {
  // Clear modal inputs
  taskForm.reset();
  tagsPreview.innerHTML = '';
  checklistItemsList.innerHTML = '';
  currentModalSubtasks = [];
  
  if (taskId) {
    // Edit Mode
    const task = boardState.tasks.find(t => t.id === taskId);
    if (!task) return;

    document.getElementById('modalTitle').textContent = 'Edit Task';
    document.getElementById('taskFormId').value = task.id;
    document.getElementById('taskFormColumnId').value = task.columnId;
    
    document.getElementById('taskTitleInput').value = task.title;
    document.getElementById('taskDescInput').value = task.description || '';
    document.getElementById('taskPriorityInput').value = task.priority;
    document.getElementById('taskDueDateInput').value = task.dueDate || '';
    document.getElementById('taskTagsInput').value = task.tags ? task.tags.join(', ') : '';

    if (task.checklist) {
      currentModalSubtasks = [...task.checklist];
    }
    
    renderModalSubtasks();
    renderTagsPreview();
  } else {
    // Add Mode
    document.getElementById('modalTitle').textContent = 'Create Task';
    document.getElementById('taskFormId').value = '';
    document.getElementById('taskFormColumnId').value = columnId;
    
    document.getElementById('taskPriorityInput').value = 'medium';
  }

  // Pre-bind tags live rendering
  const tagsInput = document.getElementById('taskTagsInput');
  tagsInput.oninput = renderTagsPreview;

  openOverlay(taskModal);
}

function handleTaskFormSubmit(e) {
  e.preventDefault();
  
  const id = document.getElementById('taskFormId').value;
  const columnId = document.getElementById('taskFormColumnId').value;
  const title = document.getElementById('taskTitleInput').value.trim();
  const description = document.getElementById('taskDescInput').value.trim();
  const priority = document.getElementById('taskPriorityInput').value;
  const dueDate = document.getElementById('taskDueDateInput').value;
  
  // Format tags
  const rawTags = document.getElementById('taskTagsInput').value;
  const tags = rawTags.split(',')
    .map(t => t.trim().toLowerCase())
    .filter(t => t !== '');

  if (!title) return;

  pushToUndo();

  if (id) {
    // Update existing task
    const task = boardState.tasks.find(t => t.id === id);
    if (task) {
      task.title = title;
      task.description = description;
      task.priority = priority;
      task.dueDate = dueDate;
      task.tags = tags;
      task.checklist = currentModalSubtasks;
      showToast(`Updated task details`, triggerUndo);
    }
  } else {
    // Create new task
    const newTask = {
      id: 'task-' + Date.now(),
      columnId: columnId,
      title: title,
      description: description,
      priority: priority,
      dueDate: dueDate,
      tags: tags,
      checklist: currentModalSubtasks
    };
    boardState.tasks.push(newTask);
    showToast(`Created task "${title}"`, triggerUndo);
  }

  saveState();
  closeOverlay(taskModal);
  renderBoard();
}

function handleDeleteTask(taskId) {
  const task = boardState.tasks.find(t => t.id === taskId);
  if (!task) return;

  pushToUndo();
  boardState.tasks = boardState.tasks.filter(t => t.id !== taskId);
  saveState();
  renderBoard();
  showToast(`Deleted task "${task.title}"`, triggerUndo);
}

// --- Subtask checklist inside Modal ---

function renderModalSubtasks() {
  checklistItemsList.innerHTML = '';
  currentModalSubtasks.forEach((sub, idx) => {
    const li = document.createElement('li');
    li.className = 'checklist-item';
    li.innerHTML = `
      <div class="checklist-item-left">
        <input type="checkbox" id="modalSubchk-${idx}" ${sub.done ? 'checked' : ''}>
        <span class="checklist-item-text ${sub.done ? 'done' : ''}">${escapeHtml(sub.text)}</span>
      </div>
      <button type="button" class="delete-subtask-btn" data-sub-idx="${idx}" title="Delete Checklist Item">&times;</button>
    `;

    // Toggle checkbox event
    li.querySelector('input').addEventListener('change', (e) => {
      currentModalSubtasks[idx].done = e.target.checked;
      li.querySelector('.checklist-item-text').classList.toggle('done', e.target.checked);
    });

    // Delete subtask click
    li.querySelector('.delete-subtask-btn').addEventListener('click', () => {
      currentModalSubtasks.splice(idx, 1);
      renderModalSubtasks();
    });

    checklistItemsList.appendChild(li);
  });
}

function handleModalAddSubtask() {
  const val = newSubtaskInput.value.trim();
  if (!val) return;

  currentModalSubtasks.push({
    id: 'sub-' + Date.now() + Math.random().toString(36).substr(2, 5),
    text: val,
    done: false
  });
  newSubtaskInput.value = '';
  renderModalSubtasks();
}

function renderTagsPreview() {
  tagsPreview.innerHTML = '';
  const val = document.getElementById('taskTagsInput').value;
  if (!val) return;

  val.split(',')
    .map(t => t.trim())
    .filter(t => t !== '')
    .forEach(tag => {
      const pill = document.createElement('span');
      pill.className = 'tag-pill';
      pill.textContent = tag.toLowerCase();
      tagsPreview.appendChild(pill);
    });
}

// --- Column Modal Operations ---

function openColumnModal(columnId = null) {
  columnForm.reset();
  
  if (columnId) {
    const col = boardState.columns.find(c => c.id === columnId);
    if (!col) return;
    document.getElementById('columnModalTitle').textContent = 'Rename Column';
    document.getElementById('columnFormId').value = col.id;
    document.getElementById('columnTitleInput').value = col.title;
  } else {
    document.getElementById('columnModalTitle').textContent = 'Add Column';
    document.getElementById('columnFormId').value = '';
  }

  openOverlay(columnModal);
  document.getElementById('columnTitleInput').focus();
}

function handleColumnFormSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('columnFormId').value;
  const title = document.getElementById('columnTitleInput').value.trim();

  if (!title) return;

  pushToUndo();

  if (id) {
    // Rename Column
    const col = boardState.columns.find(c => c.id === id);
    if (col) {
      col.title = title;
      showToast(`Renamed column to "${title}"`, triggerUndo);
    }
  } else {
    // Add Column
    const newColId = 'col-' + Date.now();
    boardState.columns.push({
      id: newColId,
      title: title
    });
    showToast(`Added column "${title}"`, triggerUndo);
  }

  saveState();
  closeOverlay(columnModal);
  renderBoard();
}

function handleDeleteColumn(colId) {
  const col = boardState.columns.find(c => c.id === colId);
  if (!col) return;

  const colTasks = boardState.tasks.filter(t => t.columnId === colId);
  
  let confirmMsg = `Are you sure you want to delete column "${col.title}"?`;
  if (colTasks.length > 0) {
    confirmMsg += ` This will also delete ${colTasks.length} tasks contained inside it.`;
  }

  if (confirm(confirmMsg)) {
    pushToUndo();
    boardState.columns = boardState.columns.filter(c => c.id !== colId);
    boardState.tasks = boardState.tasks.filter(t => t.columnId !== colId);
    saveState();
    renderBoard();
    showToast(`Deleted column "${col.title}"`, triggerUndo);
  }
}

// --- Filters & Searching ---

function filterTasks() {
  const query = searchInput.value.toLowerCase().trim();
  const priorityVal = filterPriority.value;
  const dueVal = filterDueDate.value;
  const tagVal = filterTag.value;

  const todayStr = new Date().toISOString().split('T')[0];
  const nextWeekVal = new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0];

  // Get all task cards
  document.querySelectorAll('.task-card').forEach(card => {
    const taskId = card.dataset.taskId;
    const task = boardState.tasks.find(t => t.id === taskId);
    
    if (!task) return;

    // 1. Text Search matching title, desc, and tags
    const matchesText = !query || 
      task.title.toLowerCase().includes(query) ||
      (task.description && task.description.toLowerCase().includes(query)) ||
      task.tags.some(tag => tag.toLowerCase().includes(query));

    // 2. Priority match
    const matchesPriority = priorityVal === 'all' || task.priority === priorityVal;

    // 3. Tags filter match
    const matchesTag = tagVal === 'all' || task.tags.includes(tagVal);

    // 4. Due Date filter match
    let matchesDue = true;
    if (dueVal !== 'all' && !task.dueDate) {
      matchesDue = false;
    } else if (dueVal === 'overdue') {
      matchesDue = task.dueDate < todayStr && task.columnId !== getFinalColumnId();
    } else if (dueVal === 'due-today') {
      matchesDue = task.dueDate === todayStr;
    } else if (dueVal === 'due-week') {
      matchesDue = task.dueDate >= todayStr && task.dueDate <= nextWeekVal;
    }

    // Toggle card visibility
    const visible = matchesText && matchesPriority && matchesTag && matchesDue;
    card.style.display = visible ? 'block' : 'none';
  });

  // Recalculate tasks counts in headers
  boardState.columns.forEach(col => {
    const colElement = document.querySelector(`.board-column[data-col-id="${col.id}"]`);
    if (colElement) {
      const visibleTasks = colElement.querySelectorAll('.task-card[style="display: block;"]').length;
      colElement.querySelector('.column-count').textContent = visibleTasks;
    }
  });
}

function updateTagFilterDropdown() {
  const currentSelection = filterTag.value;
  
  // Extract distinct tags
  const allTagsSet = new Set();
  boardState.tasks.forEach(task => {
    if (task.tags) {
      task.tags.forEach(t => allTagsSet.add(t));
    }
  });

  // Re-generate list items
  filterTag.innerHTML = '<option value="all">All Tags</option>';
  [...allTagsSet].sort().forEach(tag => {
    const option = document.createElement('option');
    option.value = tag;
    option.textContent = tag;
    filterTag.appendChild(option);
  });

  // Restore selection if it still exists
  if (allTagsSet.has(currentSelection)) {
    filterTag.value = currentSelection;
  }
}

// --- Analytics & Statistics updates ---

function updateStats() {
  const total = boardState.tasks.length;
  
  // 1. Total tasks counter
  document.getElementById('statTotal').textContent = total;

  // 2. Urgent / High tasks counter
  const importantCount = boardState.tasks.filter(t => t.priority === 'urgent' || t.priority === 'high').length;
  document.getElementById('statPriorityCount').textContent = importantCount;

  // 3. Overdue counter (tasks not in final column with past due dates)
  const todayStr = new Date().toISOString().split('T')[0];
  const finalColId = getFinalColumnId();
  const overdueCount = boardState.tasks.filter(t => 
    t.dueDate && t.dueDate < todayStr && t.columnId !== finalColId
  ).length;
  document.getElementById('statOverdueCount').textContent = overdueCount;

  // 4. Completion Radial Chart math
  const completedCount = finalColId 
    ? boardState.tasks.filter(t => t.columnId === finalColId).length 
    : 0;
  
  const completionRate = total > 0 ? Math.round((completedCount / total) * 100) : 0;
  document.getElementById('statCompletion').textContent = `${completionRate}%`;

  // Draw conic progress
  const radialBar = document.getElementById('statRadialBar');
  if (radialBar) {
    radialBar.style.setProperty('--progress-val', completionRate);
  }
}

// --- Confetti Animation Particle System (Pure CSS/JS) ---

function triggerConfetti() {
  const colors = ['#7b61ff', '#00f0ff', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#f43f5e'];
  const particleCount = 100;
  const bodyWidth = window.innerWidth;
  const bodyHeight = window.innerHeight;

  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    particle.className = 'confetti-particle';
    
    // Choose random styling properties
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size = Math.floor(Math.random() * 8) + 6; // 6px - 14px
    const xStart = Math.random() * bodyWidth;
    const yStart = bodyHeight + 10;
    const xEnd = xStart + (Math.random() * 200 - 100); // Drifts left or right
    const duration = (Math.random() * 2.5 + 1.5) + 's'; // 1.5s - 4.0s
    
    particle.style.background = color;
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    particle.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    
    // Pass coordinate variables to keyframes
    particle.style.setProperty('--x-start', `${xStart}px`);
    particle.style.setProperty('--y-start', `${yStart}px`);
    particle.style.setProperty('--x-end', `${xEnd}px`);
    particle.style.setProperty('--fall-duration', duration);
    
    document.body.appendChild(particle);

    // Garbage collect particle when animation ends
    particle.addEventListener('animationend', () => {
      particle.remove();
    });
  }
}

// --- Import / Export / Reset Utilities ---

function handleExport() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(boardState, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href",     dataStr);
  downloadAnchor.setAttribute("download", `zen_kanban_export_${Date.now()}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast('Board configurations downloaded!', null);
}

function handleImportSubmit() {
  const jsonStr = importJsonArea.value.trim();
  if (!jsonStr) return;

  try {
    const importedData = JSON.parse(jsonStr);
    if (!importedData.columns || !importedData.tasks) {
      throw new Error('Missing columns or tasks root keys');
    }
    
    pushToUndo();
    boardState = importedData;
    saveState();
    renderBoard();
    closeOverlay(importModal);
    showToast('Import applied successfully!', triggerUndo);
  } catch (err) {
    alert('Failed to parse JSON. Please verify structure format.\n' + err.message);
  }
}

function handleResetBoard() {
  if (confirm('Are you sure you want to reset the board to the default demo data? All current progress will be replaced.')) {
    pushToUndo();
    boardState = JSON.parse(JSON.stringify(DEFAULT_BOARD));
    saveState();
    renderBoard();
    showToast('Board reset to demo data', triggerUndo);
  }
}

// --- Overlay Controller Utils ---

function openOverlay(overlayElement) {
  overlayElement.classList.add('active');
}

function closeOverlay(overlayElement) {
  overlayElement.classList.remove('active');
}

// --- Toast Overlay Controller ---

function showToast(message, undoAction = null) {
  // Clear any existing matching toast messages to avoid spam
  const activeToasts = toastContainer.querySelectorAll('.toast');
  activeToasts.forEach(t => t.remove());

  const toast = document.createElement('div');
  toast.className = 'toast';
  
  let undoButtonHtml = '';
  if (undoAction) {
    undoButtonHtml = `<button class="toast-action-btn" id="toastUndoBtn">Undo</button>`;
  }

  toast.innerHTML = `
    <div class="toast-content">${escapeHtml(message)}</div>
    ${undoButtonHtml}
  `;

  if (undoAction) {
    toast.querySelector('#toastUndoBtn').addEventListener('click', () => {
      undoAction();
      toast.classList.add('removing');
      toast.addEventListener('animationend', () => toast.remove());
    });
  }

  toastContainer.appendChild(toast);

  // Auto remove toast after 4 seconds
  setTimeout(() => {
    if (toast.parentNode) {
      toast.classList.add('removing');
      toast.addEventListener('animationend', () => toast.remove());
    }
  }, 4000);
}

// --- Helper Functions ---

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDateString(dateStr) {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch (e) {
    return dateStr;
  }
}
