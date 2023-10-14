// GLOBALS
let maxTasksPerColumn = 93;
let inboxTotalTasks = 0;
let doneTotalTasks = 0;
let docTotalTasks = 0;
let awaitTotalTasks = 0;
let delayTotalTasks = 0;
let cancelTotalTasks = 0;
let inboxLoadedTasks = 0;
let doneLoadedTasks = 0;
let docLoadedTasks = 0;
let awaitLoadedTasks = 0;
let delayLoadedTasks = 0;
let cancelLoadedTasks = 0;
let inboxTasks = [];
let doneTasks = [];
let docTasks = [];
let awaitTasks = [];
let delayTasks = [];
let cancelTasks = [];
let debugMode = false;
let allTasks = [];
let SUCCESS_RATE = 0;
let successRateHistory = [];
let showFolders = true;
let popupEditor;
let savedTasks = null;
let searchTimeoutId;
const searchField = document.getElementById('search-input');

// EVENT LISTENERS
document.addEventListener('DOMContentLoaded', function() {
  var onglet = document.getElementById('inbox-tab');
  var event = new MouseEvent('click', {
    view: window,
    bubbles: true,
    cancelable: true
  });
  onglet.dispatchEvent(event);
});

searchField.addEventListener('keyup', function() {
  filterTasks(this.value);
});

// ATTACH EVENTS TO DOM
document.getElementById('toggleEditorButton').addEventListener('click', toggleEditor);
document.getElementById('loadMoreInbox').addEventListener('click', () => loadMoreTasks('inbox'));
document.getElementById('loadMoreDone').addEventListener('click', () => loadMoreTasks('done'));
document.getElementById('loadMoreDoc').addEventListener('click', () => loadMoreTasks('doc'));
document.getElementById('loadMoreAwait').addEventListener('click', () => loadMoreTasks('await'));
document.getElementById('loadMoreDelay').addEventListener('click', () => loadMoreTasks('delay'));
document.getElementById('loadMoreCancel').addEventListener('click', () => loadMoreTasks('cancel'));

// SET INTERVAL
setInterval(updateDelayTasksStatus, 6000);

// VERY VERY SHORT FONCTIONS

function handleCancelButtonClick(task) {
    updateTaskStatus(task, 'x-');
}

function handleDoneButtonClick(task) {
    updateTaskStatus(task, '--');
}

function handleDocButtonClick(task) {
    updateTaskStatus(task, '+-');
}

function getStatusSymbol(line) {
    const match = line.trimEnd().match(/(--|\+\-|&\-|x\-|\*-)$/);
    return match ? match[1] : null;
}

function getIndent(line) {
    return line.search(/\S|$/);
}

function getDescription(line) {
    return line.replace(/^\s*[\+\-\*]*\s*:\>?\s*/, '');
}

function handleAwaitButtonClick(task) {
    openPopup("Await", task);
}

function handleDelayButtonClick(task) {
    openPopup("Delay", task);
}

function createSpanWithText(text) {
    const span = document.createElement('span');
    span.textContent = text;
    return span;
}

function createParagraphWithText(text) {
    const paragraph = document.createElement('p');
    paragraph.textContent = text;
    return paragraph;
}

function closeModal() {
    document.getElementById("modal").style.display = "none";
    window.mainEditor.focus();
}

function saveTasks() {
    savedTasks = [...allTasks];
}

function extractKeywords(keyword) {
    const regex = /"[^"]+"|\S+/g;
    return keyword.match(regex) || [];
}

function hideMoreButtons() {
    const moreButtons = document.querySelectorAll('[id^="loadMore"]');
    moreButtons.forEach(button => button.style.display = 'none');
}

function showMoreButtons() {
    const columnIds = ['inbox', 'done', 'doc', 'await', 'delay', 'cancel'];
    columnIds.forEach(columnId => updateLoadMoreButtonVisibility(columnId));
}

// Fonction pour déterminer le nombre de tâches à charger
function getNumberToLoad(columnId, totalTasks, loadedTasks) {
  return Math.min(maxTasksPerColumn, totalTasks - loadedTasks);
}

// Fonction pour charger et mettre à jour les tâches
function loadAndUpdateTasks(columnId, totalTasks, loadedTasks, tasks) {
  const tasksToLoad = totalTasks - loadedTasks;
  if (tasksToLoad > 0) {
    const tasksToAdd = tasks.slice(loadedTasks, loadedTasks + tasksToLoad);
    addTasksToColumn(columnId, tasksToAdd);
    return tasksToAdd.length;
  }
  return 0;
}

function filterDelayTasks(tasks) {
  return tasks.filter(task => task.status === '*-');
}

function filterTasks(keyword) {
  clearSearchTimeout();
  performSearch(keyword);
}

function clearSearchTimeout() {
  clearTimeout(searchTimeoutId);
}

function performSearch(keyword) {
  searchTimeoutId = setTimeout(() => {
    regenerateTasks(keyword);
  }, 500); // Ajustez la durée du délai (en millisecondes) au besoin
}

// VERY SHORT FONCTIONS

function initPopupEditor() {
    popupEditor = ace.edit("popup-editor");
    popupEditor.setTheme("ace/theme/github");
    popupEditor.session.setMode("ace/mode/yaml");
}
  
function getParentTask(indent, contextStack) {
  for (let i = contextStack.length - 1; i >= 0; i--) {
    if (contextStack[i].indent < indent) {
      return contextStack[i];
    }
  }
  return null;
}

function closePopup() {
    const popupContainer = document.getElementById("popupContainer");
    const overlay = document.querySelector(".overlay");
    document.body.removeChild(popupContainer);
    document.body.removeChild(overlay);
}

function handleDateInputClick() {
    const dateInput = document.getElementById("dateInput");
    const durationInput = document.getElementById("durationInput");

    dateInput.disabled = false;
    dateInput.classList.remove("disabled");
    durationInput.disabled = true;
    durationInput.classList.add("disabled");
}

function handleDurationInputClick() {
    const dateInput = document.getElementById("dateInput");
    const durationInput = document.getElementById("durationInput");

    dateInput.disabled = true;
    dateInput.classList.add("disabled");
    durationInput.disabled = false;
    durationInput.classList.remove("disabled");
}
function toggleEditor() {
    var editor = document.getElementById('editor');
    if (editor.style.display === 'none') {
        editor.style.display = 'block';
    } else {
        editor.style.display = 'none';
    }
}

function updateTaskDelay(task, delayTimestamp) {
    const lines = window.mainEditor.session.doc.getAllLines();
    const taskLineIndex = parseInt(task.id || task.target.dataset.task_id) - 1;
    let taskLine = lines[taskLineIndex];
  
    // Supprimer le délai existant, s'il en existe un
    taskLine = taskLine.replace(/delay:(\s*\d+)?/g, '').trimEnd();
  
    // Ajouter le nouveau délai
    lines[taskLineIndex] = `${taskLine} (delay=${parseInt(delayTimestamp)})`;
    window.mainEditor.session.doc.setValue(lines.join("\n"));
}


function updateTaskAwait(task, awaitTimestamp) {
    const lines = window.mainEditor.session.doc.getAllLines();
    const taskLineIndex = parseInt(task.id || task.target.dataset.task_id) - 1;
    let taskLine = lines[taskLineIndex];
  
    // Supprimer le délai existant, s'il en existe un
    taskLine = taskLine.replace(/delay:(\s*\d+)?/g, '').trimEnd();
  
    // Ajouter le nouveau délai
    lines[taskLineIndex] = `${taskLine} (`+"delay"+`=${parseInt(awaitTimestamp)})`;
    window.mainEditor.session.doc.setValue(lines.join("\n"));
}

function createDivWithClass(className) {
    const div = document.createElement('div');
    div.classList.add(className);
    return div;
}

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = ("0" + (date.getMonth() + 1)).slice(-2);
    const day = ("0" + date.getDate()).slice(-2);
    return `${day}/${month}/${year}`;
}

function createButton(label, className, onClick) {
    const button = document.createElement('button');
    button.classList.add('button', className);
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
}

function createBoldGreyParagraphWithText(text) {
    const paragraph = document.createElement('p');
    const boldText = document.createElement('strong');
    boldText.textContent = text;
    paragraph.appendChild(boldText);
    paragraph.style.color = 'grey';
    return paragraph;
}

// SHORT FONCTIONS

function isChildTask(line, index, lines) {
  const indent = getIndent(line, lines);
  const nextLine = lines[index + 1];
  return nextLine && getIndent(nextLine, lines) > indent;
}

function addTaskToTop(editor_source, editor_destination, yaml) {
    const cursorPosition = editor_destination.getCursorPosition();
    const cursorRow = cursorPosition.row;
    const cursorColumn = cursorPosition.column;
    editor_destination.session.insert({row: 0, column: 0}, `${yaml}\n`);
    editor_destination.gotoLine(cursorRow, cursorColumn);
    editor_source.setValue("");
    editor_destination.resize();
}


function updateTaskStatus(task, newStatusSymbol) {
  const lines = window.mainEditor.session.doc.getAllLines();
  const taskLineIndex = parseInt(task.id || task.target.dataset.task_id) - 1;
  let taskLine = lines[taskLineIndex].trimEnd();
  const currentStatusSymbol = getStatusSymbol(taskLine);

  // Supprimer tous les symboles de statut existants dans la description
  taskLine = taskLine.replace(/(-|\+|&|x|\*)-$/g, '').trimEnd();
  
  lines[taskLineIndex] = taskLine.replace(taskLine, `${taskLine} ${newStatusSymbol}`);
  window.mainEditor.session.doc.setValue(lines.join("\n"));
  
  // Reapply current search filter after changing task status
  const searchInput = document.querySelector('#search-input'); // replace this with your actual search input selector
  const currentSearchFilter = searchInput.value;
  filterTasks(currentSearchFilter);
}


function handleAwaitConfirmButtonClick(task) {
  const dateInput = document.getElementById("dateInput");
  const durationInput = document.getElementById("durationInput");
  const inputValue = dateInput.value || durationInput.value;
  
  const awaitTimestamp = calculateTargetTimestamp(inputValue);
  
  updateTaskAwait(task, awaitTimestamp); // Ajoutez cette ligne
  updateTaskStatus(task, '&-');
  closePopup();
}

function handleDelayConfirmButtonClick(task) {
  const dateInput = document.getElementById("dateInput");
  const durationInput = document.getElementById("durationInput");
  const inputValue = dateInput.value || durationInput.value;

  const delayTimestamp = calculateTargetTimestamp(inputValue);
  
  updateTaskDelay(task, delayTimestamp); // Ajoutez cette ligne
  updateTaskStatus(task, '*-');
  closePopup();
}

function getCookie(cname) {
  const name = cname + "=";
  const decodedCookie = decodeURIComponent(document.cookie);

  const ca = decodedCookie.split(";");
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === " ") {
      c = c.substring(1);
    }
    if (c.indexOf(name) === 0) {
      return c.substring(name.length, c.length);
    }
  }
  return "";
}

function calculateTargetTimestamp(inputValue) {
  let targetTimestamp;
  const now = new Date();

  if (inputValue.includes("-")) { // Date format : yyyy-mm-dd
    targetTimestamp = new Date(inputValue).getTime();
  } else { // Duration format : number of minutes
    const minutes = parseInt(inputValue);
    const durationInMs = minutes * 60 * 1000;
    targetTimestamp = now.getTime() + durationInMs;
  }

  return targetTimestamp;
}

function handleInputChange() {
  const dateInput = document.getElementById("dateInput");
  const durationInput = document.getElementById("durationInput");
  const delayButton = document.getElementById("delayButton");

  if (dateInput.value || durationInput.value) {
    delayButton.disabled = false;
  } else {
    delayButton.disabled = true;
  }
}

function cleanUpContext(context_array) {

  let i = 0;
  let result = "";
  for (; i <= context_array.length - 1; i++) {
    result += cleanUpDescription(context_array[i]);
    result += " > ";
  }
  return result.trimEnd().slice(0, -1);
}


function extractAttributes(description) {
    const attributes = {};
    const matches = description.match(/\(([a-z]+)=(.*?)\)/g);
    if (matches) {
        matches.forEach((match) => {
        const attributeMatch = match.match(/\(([a-z]+)=(.*?)\)/);
        if (attributeMatch && attributeMatch.length === 3) {
            const attributeName = attributeMatch[1];
            const attributeValue = attributeMatch[2];
            attributes[attributeName] = attributeValue;
        }
        });
    }
    return attributes;
}

function toggleTheme() {
    let theme = window.mainEditor.getTheme();
    let newTheme =
        theme === "ace/theme/monokai"
        ? "ace/theme/github"
        : "ace/theme/monokai";
    window.mainEditor.setTheme(newTheme);
    popupEditor.setTheme(newTheme);
}


function parseProjects(editorContent) {
    const lines = editorContent.split('\n');
    const projects = [];

    lines.forEach((line, index) => {
        if (isProject(line, index, lines)) {
            const description = line.replace(':', '').trim();
            projects.push({ description });
        }
    });

    return projects;
}

// Fonction de comparaison (sort) pour trier par attribut `delay`
function compareTasksByDelay(a, b) {
    if (a.delay < b.delay) {
        return 1;
    } else if (a.delay > b.delay) {
        return -1;
    } else {
        return 0;
    }
}

function addTimestampAttributes(task) {
  const now = new Date().getTime();
  const attributes = [];

  if (task.atime !== null && task.atime !== undefined) {
    attributes.push(`(ctime=${task.atime})`);
  }

  if (task.mtime !== null && task.mtime !== undefined) {
    attributes.push(`(mtime=${task.mtime})`);
  }

  if (attributes.length > 0) {
    const attributeString = attributes.join('');
    task.description = `${task.description}${attributeString}`;
  }

  return task;
}

function highlightTaskLine(task) {
  const editor = ace.edit('editor');
  const lineNumber = task.id - 1;

  // Désélectionner toute sélection précédente
  editor.selection.clearSelection();

  // Mettre en évidence la ligne correspondante
  editor.selection.moveCursorToPosition({ row: lineNumber, column: 0 });
  editor.selection.selectLine();

  // Faites défiler l'éditeur jusqu'à la ligne en surbrillance
  editor.scrollToLine(lineNumber, true, true, () => {});
  editor.focus();
}


// Fonction pour masquer le bouton "Charger plus" pour une colonne donnée
function hideLoadMoreButton(columnId) {
  const loadMoreButton = document.getElementById(`loadMore${columnId.charAt(0).toUpperCase() + columnId.slice(1)}`);
  if (loadMoreButton) {
    loadMoreButton.style.display = 'none';
  }
}

// Fonction principale pour charger plus de tâches
function loadMoreTasks(columnId) {
  const totalTasks = getTotalTasksForColumn(columnId);
  const loadedTasks = getLoadedTasksForColumn(columnId);
  const numberToLoad = loadAndUpdateTasks(columnId, totalTasks, loadedTasks, getTasksForColumn(columnId));
  updateLoadMoreButtonVisibility(columnId);
}

// Fonction pour ajouter des tâches à une colonne
function addTasksToColumn(columnId, tasksToAdd) {
  const column = document.getElementById(columnId);
  for (const task of tasksToAdd) {
    const taskElement = createTaskElement(task);
    column.appendChild(taskElement);
  }
}

// MEDIUM FONCTIONS

// Fonction pour obtenir la liste de tâches pour une colonne donnée
function getTasksForColumn(columnId) {
  switch (columnId) {
    case 'inbox':
      return inboxTasks;
    case 'done':
      return doneTasks;
    case 'doc':
      return docTasks;
    case 'await':
      return awaitTasks;
    case 'delay':
      return delayTasks;
    case 'cancel':
      return cancelTasks;
    default:
      return [];
  }
}

function processTaskLine(line, taskId, index, lines, contextStack, tasks) {
  const task = getTaskDetails(line, taskId, index, lines);
  const parentTask = getParentTask(task.indent, contextStack);

  if (parentTask) {
    task.context = parentTask.context.slice();
    task.context.push(parentTask.id);
  }

  if (isChildTask(line, index, lines)) {
    task.is_project = true;
  }

  tasks.push(task);
  return taskId + 1;
}

function parseYaml(yaml) {
  const lines = yaml.split("\n");
  const tasks = [];
  let taskId = 1;
  const contextStack = [];

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (line.trim() === '') {
      taskId++;
      continue;
    }
    taskId = processTaskLine(line, taskId, index, lines, contextStack, tasks);
    contextStack.push(tasks[tasks.length - 1]);
  }

  const updatedTasks = updateTaskContext(tasks);
  return updatedTasks;
}

function generateTasks(editorContent) {
  if (!editorContent) {
    return handleNoContent();
  }

  let tasks;
  let projects;

  try {
    tasks = parseYaml(editorContent);
    projects = parseProjects(editorContent);
    updateViewer(tasks);
  } catch (e) {
    console.error("Erreur lors du chargement du contenu de l'éditeur :", e);
    return [];
  }

  saveData(tasks);

  const delayTasks = filterDelayTasks(tasks);
  return transformTasks(delayTasks, projects);
}

function transformTasks(tasks, projects) {
  return tasks.map(task => {
    task.description = task.description.trimEnd();

    if (task.description.includes("(ctime=")) {
      return task;
    } else {
      const now = new Date().getTime();
      const atime = ` (ctime=${now})`;
      const attributes = [];

      if (task.attributes.mtime !== null && task.attributes.mtime !== undefined) {
        attributes.push(`mtime=${task.attributes.mtime}`);
      }
      // ctime is taken from atime
      if (task.attributes.atime !== null && task.attributes.atime !== undefined) {
        attributes.push(`ctime=${task.attributes.atime}`);
      }

      const attributesString = attributes.length > 0 ? `(${attributes.join(",")})` : "";
      const description = task.description + (attributesString ? " " : "") + attributesString + atime;

      if (projects.some(project => project.description === description)) {
        task.description = description + ":";
      } else {
        task.description = description;
      }

      return task;
    }
  });
}

function filterTasksBySingleKeyword(tasks, keyword) {
  keyword = keyword.toLowerCase();

  if (keyword.startsWith('"') && keyword.endsWith('"')) {
    const phrase = keyword.slice(1, -1).toLowerCase();
    return tasks.filter(task =>
      !(task.description.toLowerCase().includes(phrase) ||
      task.context.join(' ').toLowerCase().includes(phrase))
    );
  } else if (keyword.startsWith('+')) {
    const accentuatedKeyword = keyword.slice(1).toLowerCase();
    return tasks.filter(task =>
      task.description.toLowerCase().includes(accentuatedKeyword) ||
      task.context.join(' ').toLowerCase().includes(accentuatedKeyword)
    );
  } else if (keyword.startsWith('-')) {
    const reducedKeyword = keyword.slice(1).toLowerCase();
    return tasks.filter(task =>
      !(
        task.description.toLowerCase().includes(reducedKeyword) ||
        task.context.join(' ').toLowerCase().includes(reducedKeyword)
      )
    );
  } else {
    return tasks.filter(task =>
      task.description.toLowerCase().includes(keyword) ||
      task.context.join(' ').toLowerCase().includes(keyword)
    );
  }
}

// Fonction pour obtenir le nombre total de tâches pour une colonne donnée
function getTotalTasksForColumn(columnId) {
  switch (columnId) {
    case 'inbox':
      return inboxTotalTasks;
    case 'done':
      return doneTotalTasks;
    case 'doc':
      return docTotalTasks;
    case 'await':
      return awaitTotalTasks;
    case 'delay':
      return delayTotalTasks;
    case 'cancel':
      return cancelTotalTasks;
    default:
      return 0;
  }
}

// Fonction pour obtenir le nombre de tâches chargées pour une colonne donnée
function getLoadedTasksForColumn(columnId) {
  switch (columnId) {
    case 'inbox':
      return inboxLoadedTasks;
    case 'done':
      return doneLoadedTasks;
    case 'doc':
      return docLoadedTasks;
    case 'await':
      return awaitLoadedTasks;
    case 'delay':
      return delayLoadedTasks;
    case 'cancel':
      return cancelLoadedTasks;
    default:
      return 0;
  }
}

function updateTaskContext(tasks) {
  return tasks.map((task) => {
    task.context = task.context.map((taskId) => {
      const matchingTask = tasks.find((t) => t.id === taskId);
      return matchingTask ? matchingTask.description : taskId;
    });
    task.clean_context = cleanUpContext(task.context);
    return task;
  });
}

// Fonction pour gérer le cas où il n'y a plus de tâches à charger
function handleNoMoreTasksToLoad(columnId, totalTasks, loadedTasks) {
  const numberToLoad = getNumberToLoad(columnId, totalTasks, loadedTasks);
  if (numberToLoad === 0) {
    loadedTasks = 0; // Réinitialisation des tâches chargées
    return getNumberToLoad(columnId, totalTasks, loadedTasks);
  }
  return numberToLoad;
}

function handleNoContent() {
  saveData([]);
  updateTab("inbox", []);
  updateViewer([]);
  return [];
}

function regenerateTasks(keyword) {
  const editorContent = window.mainEditor.getValue();
  allTasks = parseYaml(editorContent);

  if (!keyword) {
    updateViewer(allTasks);
    showMoreButtons();
  } else {
    filterTasksByKeyword(keyword);
  }
}

function extractKeywords(keyword) {
  return keyword.split(' ');
}

function filterTasksByKeyword(keyword) {
  const keywords = extractKeywords(keyword);
  let filteredTasks = allTasks;

  for (const keyword of keywords) {
    filteredTasks = filterTasksBySingleKeyword(filteredTasks, keyword);
  }

  updateViewer(filteredTasks);
  hideMoreButtons();
}

function cleanUpDescription(content) {
  content = content.trim();

  // Supprimer les attributs entre parenthèses
  content = content.replace(/\([^()]+\)/g, '');

  // Retirer les bullet points de liste du début de la phrase
  content = content.replace(/^\s*[-*]*\s*/, '');

  // Retirer les ":" résiduels à la fin de la description
  content = content.replace(/:\s*$/, '');

  // Retirer les symboles "--", "x-", "*-", "+-", et "&+"
  content = content.replace(/(-|x|\*|\+|&)-$/g, '');

  // Mettre en majuscule la première lettre de la description
  content = content.charAt(0).toUpperCase() + content.slice(1);

  // Mettre en majuscule tout caractère après un signe de ponctuation demandant une majuscule
  content = content.replace(/([.!?])\s*(\w)/g, (match, punctuation, letter) => {
    return punctuation + ' ' + letter.toUpperCase();
  });

  return content.trim(); // Supprimer les espaces supplémentaires en début et fin de la description
}

function formatTime(milliseconds) {
  let totalSeconds = Math.floor(milliseconds / 1000);
  let totalMinutes = Math.floor(totalSeconds / 60);
  let totalHours = Math.floor(totalMinutes / 60);
  let totalDays = Math.floor(totalHours / 24);

  let days = totalDays;
  let hours = totalHours % 24;
  let minutes = totalMinutes % 60;
  let seconds = totalSeconds % 60;

  let result = '';
  if (days > 0) {
    result += `${days} day(s) `;
  }
  if (hours > 0) {
    result += `${hours} hour(s) `;
  }
  if (minutes > 0) {
    result += `${minutes} minute(s) `;
  }
  if (seconds > 0) {
    result += `${seconds} second(s) `;
  }

  return result || '0 seconds';
}

function isProject(line, index, lines) {
    const childrenRegex = /:\s*$/;
    const childTaskRegex = /^\s{2,}[\+\-\*]/;

    if (line.match(childrenRegex)) {
        const indent = getIndent(line);
        let nextLine = lines[index + 1];
        let hasChild = false;

        while (nextLine && getIndent(nextLine) > indent) {
        if (nextLine.match(childTaskRegex)) {
            hasChild = true;
            break;
        }
        index++;
        nextLine = lines[index + 1];
        }
        return hasChild;
    }
    return false;
}

function getTaskDetails(line, taskId, index, lines) {
  const indent = getIndent(line);
  const statusSymbol = getStatusSymbol(line);
  let description = getDescription(line);
  const attributes = extractAttributes(description);

  const atimeMatch = attributes.atime ? attributes.atime.match(/\(ctime=(.*)\)$/) : null;
  let existingAtime = atimeMatch ? atimeMatch[1] : null;
  let atimeSet = false;

  if (!existingAtime) {
    const now = new Date().getTime();
    const timestamp = now;
    existingAtime = timestamp;
    atimeSet = true;
  }

  return {
    description: attributes.description || description,
    clean_description : cleanUpDescription(attributes.description || description),
    is_project:  isProject(line, index, lines),
    status: statusSymbol,
    context: [],
    indent,
    id: `${taskId}`,
    atime: existingAtime,
    attributes: attributes,
    clean_context: "",
    delay: attributes.delay || null,
  };
}

function updateLoadMoreButtonVisibility(columnId) {
  let totalTasks;
  let loadedTasks;

  switch (columnId) {
    case 'inbox':
      totalTasks = inboxTasks.length;
      loadedTasks = inboxLoadedTasks;
      break;
    case 'done':
      totalTasks = doneTasks.length;
      loadedTasks = doneLoadedTasks;
      break;
    case 'doc':
      totalTasks = docTasks.length;
      loadedTasks = docLoadedTasks;
      break;
    case 'await':
      totalTasks = awaitTasks.length;
      loadedTasks = awaitLoadedTasks;
      break;
    case 'delay':
      totalTasks = delayTasks.length;
      loadedTasks = delayLoadedTasks;
      break;
    case 'cancel':
      totalTasks = cancelTasks.length;
      loadedTasks = cancelLoadedTasks;
      break;
    default:
      return;
  }

  const remainingTasks = totalTasks - loadedTasks;
  const loadMoreButton = document.getElementById('loadMore' + columnId.charAt(0).toUpperCase() + columnId.slice(1));

  if (totalTasks > maxTasksPerColumn && remainingTasks > 0) {
    loadMoreButton.style.display = 'block';
  } else {
    loadMoreButton.style.display = 'none';
  }
}

function createTaskElement(task) {

  // Vérifier si la description de la tâche est vide ou composée uniquement d'espaces
  if (!task.description || task.description.trim() === '') {
    return null;
  }

  const taskClass = task.is_project ? "project" : "simple-task";
  const taskElement = createDivWithClass('task');
  taskElement.classList.add(taskClass);
  
  if (!popupEditor) {
    initPopupEditor();
  } else {
    popupEditor.resize();
  }
  
  taskElement.appendChild(createButton('Cancel', 'red', () => handleCancelButtonClick(task)));
  taskElement.appendChild(createButton('Done', 'green', () => handleDoneButtonClick(task)));
  taskElement.appendChild(createButton('Await', 'blue', () => handleAwaitButtonClick(task)));
  taskElement.appendChild(createButton('Delay', 'yellow', () => handleDelayButtonClick(task)));
  taskElement.appendChild(createButton('Doc', 'dark-blue', () => handleDocButtonClick(task)));
  
  const taskTextElement = createTaskTextElement(task);  
  taskTextElement.className = 'task-text-action';
  
  taskTextElement.onclick = () => highlightTaskLine(task);
  taskElement.appendChild(taskTextElement);
  
  return taskElement;
}

function createTaskTextElement(task) {
  let context = createBoldGreyParagraphWithText(task.clean_context);
  let action = createParagraphWithText(task.clean_description);
  let container = createDivWithClass("action");
  const delayText = document.createElement("div");
  delayText.style.display = "flex";
  
  // Ajoute le timestamp du délai s'il existe, se transforme en deadline
  if (task.delay) {
    delayText.textContent = `[${formatTimestamp(parseInt(task.delay,10))}]`;
    delayText.style.color = "grey";
	action.style.marginLeft = "5px";
    context.appendChild(delayText);
  }
  delayText.appendChild(action);
  context.appendChild(delayText);
  container.appendChild(context);
  return container;
}

function updateTab(tabId, tasks) {
    const tab = document.getElementById(tabId);
    if (!tab) {
        console.error('Tab not found:', tabId);
        return;
    }

    const taskList = document.createElement('div');
    taskList.classList.add("task-list");
    tasks.forEach((task) => {
        const taskElement = createTaskElement(task);
        taskList.appendChild(taskElement);
    });

    const tabTasks = document.getElementById(tabId + '-tasks');
    tabTasks.innerHTML = '';
    if (tabId === 'inbox') {
        const emptyInboxMessage = document.getElementById('empty-inbox-message');
        if (tasks.length === 0) {
        emptyInboxMessage.style.display = 'block';
        } else {
        emptyInboxMessage.style.display = 'none';
        }
    }

    tabTasks.appendChild(taskList);
}

function openModal() {
  document.getElementById("modal").style.display = "block";
  if (!popupEditor) {
    initPopupEditor();
  } else {
    const searchInput = document.getElementById("search-input");
    const searchValue = searchInput.value.trim();
    
    if (searchValue !== "") {
      popupEditor.setValue(searchValue + "\n ");
      popupEditor.clearSelection();
    }
    
    popupEditor.resize();
    popupEditor.focus();
  }
}

function validateYaml() {
    let content = popupEditor.getValue();
    try {
        addTaskToTop(popupEditor, window.mainEditor, content);
        closeModal();
        document.getElementById("yaml-error").style.display = "none";
    } catch (e) {
        document.getElementById("yaml-error-message").innerText = e.message;
        document.getElementById("yaml-error").style.display = "block";
    }
}

// Assurez-vous que Ace est chargé avant d'appeler cette fonction.
function addAndRemoveLine() {
  const mainEditor = ace.edit('editor'); // Remplacez 'mainEditor' par l'ID de l'élément contenant votre éditeur Ace
  const session = mainEditor.getSession();
  const linesCount = session.getLength();
  
  // Ajouter une nouvelle ligne à la fin
  session.insert({ row: linesCount, column: 0 }, '\n');
  
  // Supprimer la nouvelle ligne après un certain temps
  setTimeout(() => {
    const newLinesCount = session.getLength();
    session.remove({ start: { row: newLinesCount - 1, column: 0 }, end: { row: newLinesCount, column: 0 } });
  }, 1); // Le délai avant de supprimer la ligne. Ici, il est défini sur 3000 millisecondes (3 secondes).
}

function restoreTasks() {
  if (savedTasks) {
    allTasks = [...savedTasks];
    savedTasks = null;

    // Update "more" buttons after restoring tasks
    updateLoadMoreButtonVisibility('inbox');
    updateLoadMoreButtonVisibility('done');
    updateLoadMoreButtonVisibility('doc');
    updateLoadMoreButtonVisibility('await');
    updateLoadMoreButtonVisibility('delay');
    updateLoadMoreButtonVisibility('cancel');
  }
}

// Fonction pour mettre à jour l'éditeur
function updateEditor() {
  const editor = ace.edit("editor");
  const session = editor.getSession();
  const cursor = editor.selection.getCursor();

  // Récupérer la ligne actuelle
  const currentRow = cursor.row;
  const currentLine = session.getLine(currentRow);

  // Vérifier si la ligne est une tâche de plus de 1 caractère
  if (currentLine.trim().length >= 1) {
    const indent = currentLine.match(/^\s*/)[0]; // Récupérer l'indentation de la ligne

    // Vérifier si la ligne commence déjà par "(ctime="
    if (!currentLine.trim().startsWith("(ctime=")) {
      // Insérer "(ctime=__timestamp__) " au début de la ligne
      const newTimestamp = `(ctime=${new Date().getTime()}) `;
      const updatedLine = `${indent}${newTimestamp}${currentLine.trim()}`;

      // Récupérer la position actuelle du curseur
      const currentColumn = cursor.column;

      // Insérer le texte mis à jour dans l'éditeur
      session.replace({ start: { row: currentRow, column: 0 }, end: { row: currentRow, column: currentLine.length } }, updatedLine);

      // Calculer la nouvelle position du curseur
      const newColumn = currentColumn + newTimestamp.length;

      // Déplacer le curseur à la nouvelle position
      editor.selection.moveCursorTo(currentRow, newColumn, true);
    }
  }

}

// LONG FUNCTIONS

function updateViewer(tasks) {
  inboxLoadedTasks = 0;
  doneLoadedTasks = 0;
  docLoadedTasks = 0;
  awaitLoadedTasks = 0;
  delayLoadedTasks = 0;
  cancelLoadedTasks = 0;
  allTasks = [];
  doneTasks = [];
  docTasks = [];
  awaitTasks = [];
  cancelTasks = [];
  delayTasks = [];
  inboxTasks = [];
  tasks.forEach((task, index) => {
    let taskWithTab = { ...task, originalIndex: index }; // Ajoutez l'index d'origine à chaque tâche
    if (task.is_project) {
      taskWithTab.tab = 'project';
    } else {
      switch (task.status) {
        case '--':
          taskWithTab.tab = 'done';
          doneTasks.push(task);
          break;
        case '+-':
          taskWithTab.tab = 'doc';
          docTasks.push(task);
          break;
        case '&-':
          taskWithTab.tab = 'await';
          awaitTasks.push(task);
          break;
        case 'x-':
          taskWithTab.tab = 'cancel';
          cancelTasks.push(task);
          break;
        case '*-':
          taskWithTab.tab = 'delay';
          delayTasks.push(task);
          break;
        default:
          taskWithTab.tab = 'inbox';
          inboxTasks.push(task);
          break;
      }
    }
    allTasks.push(taskWithTab);
  });
  allTasks.sort((a, b) => {
    if (a.tab === b.tab) {
      if ((a.tab === 'delay' || a.tab === 'await') && a.delay !== b.delay) {
        return a.delay - b.delay;
      } else {
        return a.originalIndex - b.originalIndex;
      }
    } else {
      return 0;
    }
  });
  ['inbox', 'done', 'doc', 'await', 'delay', 'cancel'].forEach(columnId => {
    let columnTasks = allTasks.filter(task => task.tab === columnId);
    let numberToLoad = Math.min(maxTasksPerColumn, columnTasks.length);
    updateTab(columnId, columnTasks.slice(0, numberToLoad), numberToLoad);
    switch (columnId) {
      case 'inbox':
        inboxLoadedTasks += numberToLoad;
        break;
      case 'done':
        doneLoadedTasks += numberToLoad;
        break;
      case 'cancel':
        cancelLoadedTasks += numberToLoad;
        break;
      case 'delay':
        delayLoadedTasks += numberToLoad;
        break;
      case 'await':
        awaitLoadedTasks += numberToLoad;
        break;
      case 'doc':
        docLoadedTasks += numberToLoad;
        break;
    }
    updateLoadMoreButtonVisibility(columnId);
  });
  let totalNonProjectTasks = doneTasks.length + docTasks.length + awaitTasks.length + cancelTasks.length + delayTasks.length;
  let totalTasks = tasks.filter(task => !task.is_project).length;
  if (totalTasks > 0) { // Évite la division par zéro
     let successRate = (totalNonProjectTasks / totalTasks) * 100;
     let now = Date.now();
     successRateHistory.push({ rate: successRate, time: now });
     let totalDelay = 0;
     let totalTimeBetweenTasks = 0;
     let count = successRateHistory.length;
     for (let i = 1; i < count; i++) {
        let changeInRate = successRateHistory[i].rate - successRateHistory[i - 1].rate;
        let changeInTime = successRateHistory[i].time - successRateHistory[i - 1].time;
        if (changeInRate !== 0) {
          totalDelay += changeInTime / changeInRate;
        }
        totalTimeBetweenTasks += changeInTime;
      }
      let averageDelay = totalDelay / (count - 1);
      let averageTimeBetweenTasks = totalTimeBetweenTasks / (count - 1);
      let remainingSuccess = 100 - successRate;
      let tasksRemaining = totalTasks - totalNonProjectTasks;
      let totalTimeRemaining = averageTimeBetweenTasks * tasksRemaining;

      let secondsRemaining = Math.floor(totalTimeRemaining / 1000) % 60;
      let minutesRemaining = Math.floor((totalTimeRemaining / 1000 / 60) % 60);
      let hoursRemaining = Math.floor(totalTimeRemaining / 1000 / 60 / 60);
      if (successRate.toFixed(2) != 0) {
        let successRateElement = document.getElementById('success-rate');
        successRateElement.textContent = `Success Rate: ${(!successRate) ? "0" : successRate.toFixed(2)}%`;
        successRateElement.style.display = 'block';
      }

     if(hoursRemaining || minutesRemaining && successRate.toFixed(2) == 100) {
       let predictionElement = document.getElementById('prediction');
       predictionElement.textContent = `ETA: ${hoursRemaining} hours, ${minutesRemaining} minutes`;
       predictionElement.style.display = 'block';
     }
  } else {
    let successRateElement = document.getElementById('success-rate');
    successRateElement.textContent = `Success Rate: 0%`;
    successRateElement.style.display = 'block';
  }
}

function updateDelayTasksStatus() {
  const now = new Date().getTime();
  const editor = ace.edit("editor");
  const session = editor.getSession();
  let tasksUpdated = false;
  
  for (let i = 0; i < allTasks.length; i++) {
    const task = allTasks[i];
    if ((task.tab === 'delay' || task.tab === 'await') && task.delay && task.delay <= now) {
      const taskDescription = task.description;
      const taskRegExp = new RegExp(`^\\s*${taskDescription.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[-+&x*]?`, 'm');
      const match = session.getValue().match(taskRegExp);

      if (match) {
        const lineNumber = session.getValue().substring(0, match.index).split('\n').length - 1;
        const lineContent = session.getLine(lineNumber);
        const updatedLine = lineContent
          .replace(/[-+&x*]{1,2}/g, '')
          .trimEnd()
          .replace(/\(delay *=[^ ]*\)/g, '')
          .trimEnd();

        // Update the task status in allTasks
        allTasks[i].status = null;
        allTasks[i].tab = 'inbox';
        tasksUpdated = true;

        // Update the line in the editor
        session.replace(
          { start: { row: lineNumber, column: 0 },
            end: { row: lineNumber, column: lineContent.length }
          },
          updatedLine
        );
      }
    }
  }

  if (tasksUpdated) {
    // Update tabs with new data
    ['inbox', 'done', 'doc', 'await', 'delay', 'cancel'].forEach(columnId => {
      let columnTasks = allTasks.filter(task => task.tab === columnId);
      updateTab(columnId, columnTasks.slice(0, maxTasksPerColumn));
      updateLoadMoreButtonVisibility(columnId);
    });
  }
}

function openPopup(title, task) {

  const overlay = document.createElement("div");
  overlay.classList.add("overlay");

  const peopleLabel = document.createElement("label");
  peopleLabel.textContent = "Related People:";

  const peopleTextarea = document.createElement("textarea");
  peopleTextarea.id = "peopleTextarea";
  peopleTextarea.placeholder = "Enter the names of the related people, separated by commas";

  const popupContainer = document.createElement("div");
  popupContainer.id = "popupContainer";
  popupContainer.classList.add("popup-container");

  const popupContent = document.createElement("div");
  popupContent.classList.add("popup-content");

  const popupTitle = document.createElement("h2");
  popupTitle.textContent = title + " until :";

  const dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.id = "dateInput";
  dateInput.addEventListener("click", handleDateInputClick);
  dateInput.addEventListener("change", handleInputChange); // Ajoute cet écouteur d'événements

  const durationInput = document.createElement("input");
  durationInput.type = "number";
  durationInput.id = "durationInput";
  durationInput.value = 120;
  durationInput.placeholder = "Duration (in minutes)";
  durationInput.addEventListener("click", handleDurationInputClick);
  durationInput.addEventListener("change", handleInputChange); // Ajoute cet écouteur d'événements

  const cancelButton = createButton('Cancel', 'red', closePopup)
  cancelButton.classList.add("cancel-button");
  cancelButton.textContent = "Cancel";

  const delayButton = createButton(title, (title === 'Delay') ? 'yellow' : 'blue', (title === 'Delay') ? handleDelayConfirmButtonClick : handleAwaitConfirmButtonClick)
  delayButton.classList.add("delay-button");
  delayButton.textContent = title;
  delayButton.id = "delayButton"
  delayButton.dataset.task_id = task.id
  delayButton.disabled = false; // Désactive le bouton par défaut
  
  const inputContainer = document.createElement("div");
  inputContainer.classList.add("input-container");

  inputContainer.appendChild(dateInput);
  inputContainer.appendChild(durationInput);

  popupContent.appendChild(popupTitle);
  popupContent.appendChild(inputContainer);
  popupContent.appendChild(delayButton);
  popupContent.appendChild(cancelButton);


  popupContainer.appendChild(popupContent);

  document.body.appendChild(overlay);
  document.body.appendChild(popupContainer);
}




// Fonction pour remplacer les caractères accentués par leurs équivalents non accentués
function removeAccents(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}




// Gérer le clic sur le bouton d'export
document.getElementById('exportExcelButton').addEventListener('click', () => {
  exportToExcel(allTasks);
});

// Fonction pour convertir un timestamp en date lisible
function formatDateFromTimestamp(timestamp) {
    const date = new Date(Math.floor(timestamp / 1 )); // Convertir le timestamp en date 
    const formattedDate = date.toLocaleString(); // Formater la date en une chaîne lisible
    console.log(formattedDate)
  return formattedDate;
}

async function calculateProjectProgressAsync(projectName) {
    // Filter the tasks that belong to the specific project
    let projectTasks = allTasks.filter((task) => task.clean_context.includes(projectName));
    
    projectTasks = projectTasks.filter((task) => !task.is_project);
    
    const projectTasksCount = projectTasks.length;

    if (projectTasksCount === 0) {
        return -1;
    }

    // Filter active tasks (not 'doc' and not 'cancel')
    const actionableTasks = projectTasks.filter(
        (task) => task.status !== '+-' && task.status !== 'x-'
    );

    // Calculate the progress percentage
    const completedTasksCount = actionableTasks.filter((task) => task.status === '--').length;
    const percentage = (completedTasksCount / (actionableTasks.length || 1)) * 100;

    //console.log(`Nombre de tâches terminées pour le projet ${projectName}: ${completedTasksCount}`);
    //console.log(`Pourcentage d'avancement pour le projet ${projectName}: ${percentage.toFixed(2)}%`);

    return `${percentage.toFixed(2)}%`;
}



function exportToExcel(tasks) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'linrd';
    workbook.lastModifiedBy = 'guillaumefe';
    workbook.created = new Date();
    workbook.modified = new Date();

    const projectsWorksheet = workbook.addWorksheet('Projets');
    const projectsData = [];
    const projectMap = new Map();

    async function processTasks(tasks, projectMap) {
        for (const task of tasks) {
            const status = removeAccents(task.tab || 'Inconnu');
            const projectName = removeAccents(task.clean_description) || '';

            if (status === 'project' && !projectMap.has(projectName)) {
                projectMap.set(projectName, []);
            }

            if (projectMap.get(projectName)) //testr
                projectMap.get(projectName).push(task);
        }
    }

    processTasks(tasks, projectMap)
        .then(() => {
            return Promise.all(Array.from(projectMap).map(async ([projectName]) => {
                const avancement = await calculateProjectProgressAsync(projectName);

                if (avancement !== -1) {
                    const projectRow = {
                        Project: projectName,
                        Avancement: avancement,
                    };
                    projectsData.push(projectRow);
                }
            }));
        })
        .then(() => {
            const projectsHeaders = [
                { header: 'Project', key: 'Project', width: 30 },
                { header: 'Avancement', key: 'Avancement', width: 15 },
            ];
            projectsWorksheet.columns = projectsHeaders;
            projectsWorksheet.getRow(1).eachCell((cell) => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'B0E0E6' },
                };
                cell.font = { bold: true };
            });

            projectsData.forEach((projectRow, index) => {
                const backgroundColor = index % 2 === 0 ? 'B0C4DE' : 'FFFFFF';
                projectsWorksheet.addRow(projectRow).eachCell((cell) => {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: backgroundColor },
                    };
                    // Activer le retour à la ligne automatique
                    cell.alignment = { wrapText: true };
                });
            });

            const worksheet = workbook.addWorksheet('Taches');
            const headers = [
                { header: 'Action', key: 'task', width: 40 },
                { header: 'Contexte', key: 'context', width: 65 },
                { header: 'Etat', key: 'status', width: 10 },
                { header: 'Creation Time', key: 'ctime', width: 25 },
                { header: 'Next Tick', key: 'delay', width: 25 },
            ];
            worksheet.columns = headers;

            // Style the header of the 'Etat' column with center alignment
            worksheet.getCell('C1').alignment = { horizontal: 'center', vertical: 'middle' };

            // Style the header of the 'Creation Time' column with right alignment
            worksheet.getCell('D1').alignment = { horizontal: 'right', vertical: 'middle' };

            // Style the header of the 'Next Tick' column with right alignment
            worksheet.getCell('E1').alignment = { horizontal: 'right', vertical: 'middle' };

            worksheet.getRow(1).eachCell((cell) => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'B0E0E6' },
                };
                cell.font = { bold: true };
            });

            tasks
                .filter((task) => task.tab !== 'project')
                .forEach((task, index) => {
                    const dataRow = worksheet.addRow({
                        task: removeAccents(task.clean_description) || '',
                        context: removeAccents(task.clean_context) || '',
                        status: removeAccents(task.tab) || '',
                        ctime: task.attributes && task.attributes.ctime ? formatDateFromTimestamp(task.attributes.ctime) : '',
                        delay: task.delay ? formatDateFromTimestamp(task.delay) : '',
                    });

                    const backgroundColor = index % 2 === 0 ? 'B0C4DE' : 'FFFFFF';
                    dataRow.eachCell((cell) => {
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: backgroundColor },
                        };

                        // Activer le retour à la ligne automatique
                        cell.alignment = { wrapText: true };

                        // For the 'Etat' column, set center alignment for values and apply data validation
                        if (cell.address.includes('C')) {
                            cell.alignment = { horizontal: 'center', vertical: 'middle' };

                            // Configure data validation with the list from the 'Parametre' worksheet
                            cell.dataValidation = {
                                 type: 'list',
                                 formulae: ['"inbox,done,doc,await,delay,cancel"'],
                                 //allowBlank: true,
                                 showDropDown: true,
                            };
                        }

                        // For the 'Started by' column, set right alignment for values
                        if (cell.address.includes('D')) {
                            cell.alignment = { horizontal: 'right', vertical: 'middle' };
                        }

                        if (cell.address.includes('E')) {
                            cell.alignment = { horizontal: 'right', vertical: 'middle' };
                        }

                    });
                });

            const statusWorksheet = workbook.addWorksheet('Statuts');
            const statusHeaders = [
                { header: 'Statut', key: 'status', width: 15 },
                { header: "Nombre d'occurences", key: 'count', width: 30 },
            ];
            statusWorksheet.columns = statusHeaders;
            statusWorksheet.getRow(1).eachCell((cell) => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'B0E0E6' },
                };
                cell.font = { bold: true };
            });

            const statusCounts = {};
            tasks.forEach((task) => {
                const status = removeAccents(task.tab || 'Inconnu');
                // Ajoutez une condition pour exclure les projets du comptage
                if (status !== 'project') {
                    statusCounts[status] = (statusCounts[status] || 0) + 1;
                }
            });

            let index = 2;
            for (const status in statusCounts) {
                statusWorksheet.addRow([status, statusCounts[status]]);
                const backgroundColor = index % 2 === 0 ? 'B0C4DE' : 'FFFFFF';
                statusWorksheet.getCell(`A${index}`).fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: backgroundColor },
                };
                statusWorksheet.getCell(`B${index}`).fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: backgroundColor },
                };
                index++;
            }

            workbook.xlsx.writeBuffer().then((buffer) => {
                const blob = new Blob([buffer], {
                    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                });
                saveAs(blob, 'projects.xlsx');
            });
        });
}
