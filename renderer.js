let state = {
  todos: [],
  notes: '',
  theme: 'dark',
  deskLocked: false
};

const todoListEl = document.getElementById('todoList');
const todoInput = document.getElementById('todoInput');
const notesArea = document.getElementById('notesArea');
const countLabel = document.getElementById('countLabel');
const saveStatus = document.getElementById('saveStatus');
const pinBtn = document.getElementById('pinBtn');
const themeBtn = document.getElementById('themeBtn');

let saveTimer = null;
function scheduleSave() {
  saveStatus.textContent = 'saving…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    await window.api.saveData(state);
    saveStatus.textContent = 'saved';
  }, 300);
}

let draggedIndex = null;

function renderTodos() {
  todoListEl.innerHTML = '';
  state.todos.forEach((todo, index) => {
    const li = document.createElement('li');
    li.className = 'todo-item' + (todo.done ? ' done' : '');
    li.dataset.index = String(index);

    const dragHandle = document.createElement('span');
    dragHandle.className = 'todo-drag-handle';
    dragHandle.textContent = '⠿';
    dragHandle.title = '拖拉調整順序';
    dragHandle.draggable = true;
    dragHandle.addEventListener('dragstart', (e) => {
      draggedIndex = index;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));
      li.classList.add('dragging');
    });
    dragHandle.addEventListener('dragend', () => {
      li.classList.remove('dragging');
      draggedIndex = null;
    });

    li.addEventListener('dragover', (e) => {
      if (draggedIndex === null) return;
      e.preventDefault();
      li.classList.add('drag-over');
    });
    li.addEventListener('dragleave', () => {
      li.classList.remove('drag-over');
    });
    li.addEventListener('drop', (e) => {
      e.preventDefault();
      li.classList.remove('drag-over');
      const targetIndex = Number(li.dataset.index);
      if (draggedIndex === null || draggedIndex === targetIndex) return;
      const [moved] = state.todos.splice(draggedIndex, 1);
      const insertAt = draggedIndex < targetIndex ? targetIndex - 1 : targetIndex;
      state.todos.splice(insertAt, 0, moved);
      draggedIndex = null;
      renderTodos();
      scheduleSave();
    });

    const lineNum = document.createElement('span');
    lineNum.className = 'todo-linenum';
    lineNum.textContent = String(index + 1).padStart(2, '0');

    const checkbox = document.createElement('span');
    checkbox.className = 'todo-checkbox';
    checkbox.textContent = todo.done ? '[x]' : '[ ]';
    checkbox.addEventListener('click', () => {
      todo.done = !todo.done;
      renderTodos();
      scheduleSave();
    });

    const text = document.createElement('span');
    text.className = 'todo-text';
    text.textContent = todo.text;
    text.contentEditable = 'true';
    text.spellcheck = false;
    text.addEventListener('blur', () => {
      todo.text = text.textContent.trim() || todo.text;
      scheduleSave();
    });
    text.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        text.blur();
      }
    });

    const del = document.createElement('button');
    del.className = 'todo-delete';
    del.textContent = '✕';
    del.addEventListener('click', () => {
      state.todos.splice(index, 1);
      renderTodos();
      scheduleSave();
    });

    li.appendChild(dragHandle);
    li.appendChild(lineNum);
    li.appendChild(checkbox);
    li.appendChild(text);
    li.appendChild(del);
    todoListEl.appendChild(li);
  });

  const total = state.todos.length;
  const done = state.todos.filter(t => t.done).length;
  countLabel.textContent = `${done}/${total} done`;
}

todoInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && todoInput.value.trim()) {
    state.todos.push({ text: todoInput.value.trim(), done: false });
    todoInput.value = '';
    renderTodos();
    scheduleSave();
  }
});

notesArea.addEventListener('input', () => {
  state.notes = notesArea.value;
  scheduleSave();
});

// ---------- Tabs ----------
document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const target = tab.dataset.tab;
    document.getElementById('panel-todo').classList.toggle('hidden', target !== 'todo');
    document.getElementById('panel-notes').classList.toggle('hidden', target !== 'notes');
  });
});

// ---------- Theme ----------
function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  themeBtn.textContent = state.theme === 'dark' ? '◐' : '◑';
}

themeBtn.addEventListener('click', () => {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  applyTheme();
  scheduleSave();
});

// ---------- Desk lock (stick to wallpaper layer, click-through) ----------
let lastClickThrough = null;

function applyDeskLockUi() {
  pinBtn.classList.toggle('active', state.deskLocked);
  pinBtn.textContent = state.deskLocked ? '🔒' : '📌';
  pinBtn.title = state.deskLocked
    ? '目前已釘選於桌布層（不可互動），點擊解除鎖定'
    : '點擊釘選至桌布層（之後將不會遮擋其他視窗，需再按一次才能編輯）';
  document.body.classList.toggle('desk-locked', state.deskLocked);
  lastClickThrough = null;
}

pinBtn.addEventListener('click', async () => {
  state.deskLocked = !state.deskLocked;
  await window.api.setDeskLock(state.deskLocked);
  applyDeskLockUi();
  scheduleSave();
});

window.api.onDeskLockChanged((lock) => {
  state.deskLocked = lock;
  applyDeskLockUi();
});

// While desk-locked, the window is fully click-through except over the
// titlebar, which stays interactive so the lock button can be reached.
document.addEventListener('mousemove', (e) => {
  if (!state.deskLocked) return;
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const overTitlebar = !!(el && el.closest('.titlebar'));
  const shouldIgnore = !overTitlebar;
  if (shouldIgnore !== lastClickThrough) {
    lastClickThrough = shouldIgnore;
    window.api.setClickThrough(shouldIgnore);
  }
});

// ---------- Window controls ----------
document.getElementById('minBtn').addEventListener('click', () => window.api.minimize());
document.getElementById('closeBtn').addEventListener('click', () => window.api.close());

// ---------- Autostart ----------
const autostartCheck = document.getElementById('autostartCheck');
autostartCheck.addEventListener('change', () => {
  window.api.setAutostart(autostartCheck.checked);
});

// ---------- Init ----------
async function init() {
  const data = await window.api.loadData();
  state = { ...state, ...data };
  applyTheme();
  applyDeskLockUi();
  notesArea.value = state.notes || '';
  renderTodos();

  const autostartEnabled = await window.api.getAutostart();
  autostartCheck.checked = autostartEnabled;
}

init();
