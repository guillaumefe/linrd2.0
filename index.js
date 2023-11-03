let popupEditor = ace.edit("popup-editor");
let mainEditor = ace.edit("editor");

function openModal(content) {
	popupEditor.setValue("");
	document.getElementById("modal").style.display = "block";
	if (!popupEditor) {
		initPopupEditor();
	}
	let searchValue;
	if(content && !(content instanceof Event)) {
		searchValue = content.trim(" \n");
	} else {
		const searchInput = document.getElementById("search-input");
		searchValue = searchInput.value.trim(" \n")
	}

	if (searchValue !== "") {
		popupEditor.setValue(searchValue);
		popupEditor.clearSelection();
	}

	popupEditor.resize();
	popupEditor.focus();
	
}

function validateYaml() {
	let content = popupEditor.getValue();
	try {
		addTaskToTop(popupEditor, mainEditor, content); //.trim(" \n")
		closeModal();
		document.getElementById("yaml-error").style.display = "none";
	} catch (e) {
		document.getElementById("yaml-error-message").innerText = e.message;
		document.getElementById("yaml-error").style.display = "block";
	}
}

function addTaskToTop(editor_source, editor_destination, yaml) {
	const cursorPosition = editor_destination.getCursorPosition();
	const cursorRow = cursorPosition.row;
	const cursorColumn = cursorPosition.column;
	editor_destination.session.insert({ row: 0, column: 0 }, `${yaml}\n`);
	editor_destination.gotoLine(cursorRow, cursorColumn);
	editor_source.setValue("");
	editor_destination.resize();
}

function closeModal() {
	document.getElementById("modal").style.display = "none";
	mainEditor.focus();
}
	
//(() => {
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
	let allTasks = [];
	let SUCCESS_RATE = 0;
	let successRateHistory = [];
	let showFolders = true;
	let initialData = null;
	let savedTasks = null;
	let searchTimeoutId;
	let user_password = "secret"	

	const searchField = document.getElementById('search-input');
	searchField.value = "";

	// EVENT LISTENERS
	document.addEventListener('DOMContentLoaded', function () {
		var onglet = document.getElementById('inbox-tab');
		var event = new MouseEvent('click', {
			view: window,
			bubbles: true,
			cancelable: true
		});
		onglet.dispatchEvent(event);
	});

	// Vérifier si la clé "editor-enc" dans IndexedDB est vide
	async function isIndexedDBEmpty() {
	  const db = await openDatabaseSync("editorDB", 1);
	  return new Promise((resolve, reject) => {
		const transaction = db.transaction(["editorStore"], "readonly");
		const store = transaction.objectStore("editorStore");
		const request = store.get("editor-enc");

		request.onsuccess = (event) => {
		  const data = event.target.result;
		  resolve(data === undefined || data === "[]");
		};

		request.onerror = (event) => {
		  reject(event.target.error);
		};
	  });
	}
	
	// Vérifier si la clé "editor" dans IndexedDB est vide
	async function isIndexedDBEmptyBackupPreviousLinrd() {
	  const db = await openDatabaseSync("editorDB", 1);
	  return new Promise((resolve, reject) => {
		const transaction = db.transaction(["editorStore"], "readonly");
		const store = transaction.objectStore("editorStore");
		const request = store.get("editor");

		request.onsuccess = (event) => {
		  const data = event.target.result;
		  resolve(data === undefined || data === "[]");
		};

		request.onerror = (event) => {
		  reject(event.target.error);
		};
	  });
	}

	searchField.addEventListener('keyup', function () {
		filterTasks(this.value);
	});

	// ATTACH EVENTS TO DOM
	//document.getElementById('toggleEditorButton').addEventListener('click', toggleEditor);
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

	// function saveData(data) {
	//     localStorage.setItem('editor', JSON.stringify(data));
	// }

	// function loadData() {
	//     const data = localStorage.getItem("editor");
	//     const tasks = data ? JSON.parse(data) : [];
	//     let descriptions = tasks.map((task) => task.description).join("\n");
	//     return descriptions;
	// }


	// Création de la base de données IndexedDB et du magasin d'objets "editorStore"
	const request = window.indexedDB.open("editorDB", 1);

	request.onupgradeneeded = (event) => {
		const db = event.target.result;
		db.createObjectStore("editorStore");
	};

	//request.onsuccess = async (event) => {
		// La base de données IndexedDB est ouverte avec succès, vous pouvez maintenant utiliser les fonctions loadData et saveData.
	//};

	request.onerror = (event) => {
		console.error("Erreur lors de l'ouverture de la base de données IndexedDB.");
	};

	async function openDatabaseSync(dbName, version) {
	  return new Promise((resolve, reject) => {
		const request = indexedDB.open(dbName, version);

		request.onupgradeneeded = (event) => {
		  const db = event.target.result;
		  db.createObjectStore("editorStore");
		};

		request.onsuccess = (event) => {
		  resolve(event.target.result);
		};

		request.onerror = (event) => {
		  reject(event.target.error);
		};
	  });
	}

async function saveData(data) {
  const pin = user_password
  const db = await openDatabaseSync("editorDB", 1);
  const jsonData = JSON.stringify(data);

  // Chiffrer les données en utilisant le code PIN
  try {
    const encryptedData = await encryptDataWithPIN(jsonData, pin);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["editorStore"], "readwrite");
      const store = transaction.objectStore("editorStore");
      const saveRequest = store.put(encryptedData, "editor-enc");

      saveRequest.onsuccess = (event) => {
        resolve("Données chiffrées et enregistrées avec succès");
      };

      saveRequest.onerror = (event) => {
        reject(event.target.error);
      };
    });
  } catch (error) {
    return Promise.reject(error);
  }
}

	
async function loadData() {
  const pin = user_password;
  const db = await openDatabaseSync("editorDB", 1);

  return new Promise(async (resolve, reject) => {
    const transaction = db.transaction(["editorStore"], "readonly");
    const store = transaction.objectStore("editorStore");

    const dataRequest = store.get("editor-enc");

    dataRequest.onsuccess = async (event) => {
      const encryptedData = event.target.result;

      if (encryptedData) {
        try {
          // Déchiffrez les données en utilisant le code PIN fourni
          const decryptedData = await decryptDataWithPIN(encryptedData, pin);

          // Parsez les données JSON déchiffrées
          const tasks = JSON.parse(decryptedData);
          let descriptions = tasks.map((task) => task.description).join("\n");
          resolve(descriptions);
        } catch (error) {
          reject(error);
        }
      } else {
        resolve(""); // Les données sont vides
      }
    };

    dataRequest.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

async function deriveKeyFromPassword(password) {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  // Vous pouvez utiliser une méthode de dérivation de clé, par exemple PBKDF2, pour obtenir une clé CryptoKey à partir du mot de passe
  const salt = new Uint8Array(16); // Utilisez un sel aléatoire
  const iterations = 100000; // Nombre d'itérations, peut être ajusté
  const keyLength = 256; // Longueur de la clé en bits, peut être ajustée

  const derivedKey = await crypto.subtle.importKey(
    "raw",
    passwordBuffer,
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: iterations,
      hash: "SHA-256",
    },
    derivedKey,
    { name: "AES-GCM", length: keyLength },
    true,
    ["encrypt", "decrypt"]
  );
}

// Fonction pour chiffrer les données avec AES
async function encryptAES(data, password) {
  const dataBuffer = new TextEncoder().encode(data);
  const key = await deriveKeyFromPassword(password);

  const encryptedDataBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: new Uint8Array(12) },
    key,
    dataBuffer
  );

  const encryptedDataArray = Array.from(new Uint8Array(encryptedDataBuffer));
  return encryptedDataArray;
}

// Fonction pour déchiffrer les données avec AES
async function decryptAES(encryptedData, password) {
  const encryptedDataBuffer = new Uint8Array(encryptedData);
  const key = await deriveKeyFromPassword(password);

  const decryptedDataBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(12) },
    key,
    encryptedDataBuffer
  );

  return new TextDecoder().decode(decryptedDataBuffer);
}

// Chiffrer les données avec le code PIN
async function encryptDataWithPIN(data, pin) {
  try {
    const encryptedData = await encryptAES(data, pin);
    return encryptedData;
  } catch (error) {
    throw new Error("Erreur lors du chiffrement des données : " + error);
  }
}

// Déchiffrer les données avec le code PIN
async function decryptDataWithPIN(encryptedData, pin) {
  try {
    const decryptedData = await decryptAES(encryptedData, pin);
    return decryptedData;
  } catch (error) {
    throw new Error("Erreur lors du déchiffrement des données : " + error);
  }
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
		// Démarrez un délai avant de lancer la recherche
		searchTimeoutId = setTimeout(() => {
			performSearch(keyword);
		}, 500); // Vous pouvez ajuster la durée du délai (en millisecondes) au besoin
	}

	function clearSearchTimeout() {
		clearTimeout(searchTimeoutId);
	}

	function performSearch(keyword) {
		searchTimeoutId = setTimeout(() => {
			regenerateTasks(keyword);
		}, 0); // Ajustez la durée du délai (en millisecondes) au besoin
	}

	// VERY SHORT FONCTIONS

	function initPopupEditor() {
		//popupEditor.setTheme("ace/theme/github");
		popupEditor.session.setMode("ace/mode/yaml");

		// Chargez le thème à partir du localStorage ou utilisez un thème par défaut
		const savedTheme = localStorage.getItem("editorTheme");
		if (savedTheme) {
		  popupEditor.setTheme(savedTheme);
		} else {
		  popupEditor.setTheme("ace/theme/github"); // Thème par défaut
		}

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
		const lines = mainEditor.session.doc.getAllLines();
		const taskLineIndex = parseInt(task.id || task.target.dataset.task_id) - 1;
		let taskLine = lines[taskLineIndex];

		// Supprimer le délai existant, s'il en existe un
		taskLine = taskLine.replace(/delay:(\s*\d+)?/g, '').trimEnd();

		// Ajouter le nouveau délai
		lines[taskLineIndex] = `${taskLine} (delay=${parseInt(delayTimestamp)})`;
		mainEditor.session.doc.setValue(lines.join("\n"));
	}


	function updateTaskAwait(task, awaitTimestamp) {
		const lines = mainEditor.session.doc.getAllLines();
		const taskLineIndex = parseInt(task.id || task.target.dataset.task_id) - 1;
		let taskLine = lines[taskLineIndex];

		// Supprimer le délai existant, s'il en existe un
		taskLine = taskLine.replace(/delay:(\s*\d+)?/g, '').trimEnd();

		// Ajouter le nouveau délai
		lines[taskLineIndex] = `${taskLine} (` + "delay" + `=${parseInt(awaitTimestamp)})`;
		mainEditor.session.doc.setValue(lines.join("\n"));
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

	function updateTaskStatus(task, newStatusSymbol) {
		const lines = mainEditor.session.doc.getAllLines();
		const taskLineIndex = parseInt(task.id || task.target.dataset.task_id) - 1;
		let taskLine = lines[taskLineIndex].trimEnd();
		const currentStatusSymbol = getStatusSymbol(taskLine);

		// Supprimer tous les symboles de statut existants dans la description
		taskLine = taskLine.replace(/(-|\+|&|x|\*)-$/g, '').trimEnd();

		lines[taskLineIndex] = taskLine.replace(taskLine, `${taskLine} ${newStatusSymbol}`);
		mainEditor.session.doc.setValue(lines.join("\n"));

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
	
function activateDarkMode() {

	const bgLight = document.querySelectorAll('.bg-light');
    // Parcourez tous les éléments et ajoutez la classe "dark"
    bgLight.forEach((element) => {
        element.classList.add("bg-dark");
    });
	
	const navLink = document.querySelectorAll('.nav-link');
    // Parcourez tous les éléments et ajoutez la classe "dark"
    navLink.forEach((element) => {
        element.classList.add("matrixpolice");
    });
	
	const navbarToggler = document.getElementById('navbarToggler')
	navbarToggler.classList.add("matrixborder");
	
	const popupEditor = document.getElementById('popup-editor')
	popupEditor.classList.add("matrixpolice");
	
	const sourceCodeLink = document.getElementById('source-code-link')
	sourceCodeLink.classList.add("matrixpolice");
	sourceCodeLink.style.opacity = 0.1
	
	const search = document.getElementById('search-input')
	search.classList.add("dark-mode");
	
	const paypal = document.getElementById('paypal')
	paypal.style.opacity = 0.1
	
	const body = document.body;
    body.classList.add("dark-mode");
	
	const taskElements = document.querySelectorAll('.task');
    // Parcourez tous les éléments et ajoutez la classe "dark"
    taskElements.forEach((element) => {
        element.classList.add("dark-mode");
    });
	
	
	const themeDropdown = document.getElementById('themeDropdown')
	themeDropdown.classList.add("matrixpolice");
	
	const logo = document.getElementById('logo')
	logo.style.opacity = 0.1
	
	const header = document.getElementById('header')
	header.classList.add("matrixborder");
	
	localStorage.setItem('editorTheme', 'ace/theme/monokai');
	
}

function activateLightMode() {
	const bgLight = document.querySelectorAll('.bg-light');
    // Parcourez tous les éléments et ajoutez la classe "dark"
    bgLight.forEach((element) => {
        element.classList.remove("bg-dark");
    });
	
	const navLink = document.querySelectorAll('.nav-link');
    // Parcourez tous les éléments et ajoutez la classe "dark"
    navLink.forEach((element) => {
		element.classList.remove("matrixpolice");
    });
	
	
	const navbarToggler = document.getElementById('navbarToggler')
	navbarToggler.style.border = "1px solid lightgray";
	
	const popupEditor = document.getElementById('popup-editor')
	popupEditor.classList.remove('matrixpolice');
	
	const sourceCodeLink = document.getElementById('source-code-link')
	sourceCodeLink.classList.remove('matrixpolice');
	sourceCodeLink.style.opacity = 1
	
	const search = document.getElementById('search-input')
	search.classList.remove("dark-mode");
	
	const paypal = document.getElementById('paypal')
	paypal.style.opacity = 0.7
	
	const body = document.body;
    body.classList.remove("dark-mode");
	
	const taskElements = document.querySelectorAll('.task');
    // Parcourez tous les éléments et ajoutez la classe "dark"
    taskElements.forEach((element) => {
        element.classList.remove("dark-mode");

    });

	
	const themeDropdown = document.getElementById('themeDropdown')
	themeDropdown.classList.remove("matrixpolice");	
	
	const logo = document.getElementById('logo')
	logo.style.opacity = 1
	
	const header = document.getElementById('header')
	header.classList.remove("matrixborder");
	
	localStorage.setItem('editorTheme', 'ace/theme/github');
}


	function toggleTheme(theme) {
		let newTheme;
		
		if (theme) {
			if (theme === "dark") {
				newTheme = "ace/theme/monokai";
				activateDarkMode()
			} else {
				newTheme = "ace/theme/github";
				activateLightMode()
			}
			
		} else {
			theme = mainEditor.getTheme();
			newTheme = theme === "ace/theme/monokai" ? "ace/theme/github" : "ace/theme/monokai";
			activateLightMode()
		}
		mainEditor.setTheme(newTheme);
		popupEditor.setTheme(newTheme);

		// Enregistrez le thème dans le localStorage
		localStorage.setItem("editorTheme", newTheme);
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
		editor.scrollToLine(lineNumber, true, true, () => { });
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

	async function generateTasks(editorContent) {
		if (!editorContent) {
			document.getElementById("loadingOverlay").style.display = "none";
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
		setTimeout(()=>{
			document.getElementById("loadingOverlay").style.display = "none";
		}, 0)
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
		const editorContent = mainEditor.getValue();
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
			clean_description: cleanUpDescription(attributes.description || description),
			is_project: isProject(line, index, lines),
			status: statusSymbol,
			context: [],
			line : line,
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
		//taskElement.appendChild(createButton('Next action', 'white', () => handleDocButtonClick(task)));
		//for (var i = 1; i <= task.indent; i++) console.log(i);
		//const openModalButton = createButton("Next action", "white", () => openModal(task.context.map((ctx) => ctx).join("\n")) + task.clean_description));
		
		const openModalButton = createButton(
		  "Next move",
		  "white",
		  () => {
			const spaces = " ".repeat(task.indent); // Crée une chaîne d'espaces
			const descriptionWithIndent = spaces + task.clean_description; // Ajoute les espaces à la description
			openModal(task.context.map((ctx) => ctx).join("\n") + ((task.context.length) ? "\n" : "") + descriptionWithIndent + "\n" + spaces + "  ");
		  }
		);
		
		taskElement.appendChild(openModalButton);

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
			delayText.textContent = `[${formatTimestamp(parseInt(task.delay, 10))}]`;
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
	
	// CONFIGURATION pour ajouter ctime devant les taches à chaque changement- dans l'éditeur 
	mainEditor.session.on("change", updateEditor);
	
	//CONFIGURATION autre configuration
	mainEditor.setOption("showFoldWidgets", true);
	mainEditor.setTheme("ace/theme/github");
	mainEditor.session.setMode("ace/mode/yaml");

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

			if (hoursRemaining || minutesRemaining && successRate.toFixed(2) == 100) {
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
						{
							start: { row: lineNumber, column: 0 },
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

	function formatDateFromTimestamp(timestamp) {
		const date = new Date(Math.floor(timestamp / 1));
		const formattedDate = date.toLocaleString();
		return formattedDate;
	}

	async function calculateProjectProgressAsync(projectName) {
		let projectTasks = allTasks.filter((task) => task.clean_context.includes(projectName));
		projectTasks = projectTasks.filter((task) => !task.is_project);
		const projectTasksCount = projectTasks.length;
		if (projectTasksCount === 0) {
			return -1;
		}
		const actionableTasks = projectTasks.filter(
			(task) => task.status !== '+-' && task.status !== 'x-'
		);
		const completedTasksCount = actionableTasks.filter((task) => task.status === '--').length;
		const percentage = (completedTasksCount / (actionableTasks.length || 1)) * 100;
		return `${percentage.toFixed(2)}%`;
	}


	function exportToExcel(tasks) {
		const workbook = new ExcelJS.Workbook();
		workbook.creator = 'linrd';
		workbook.lastModifiedBy = 'guillaumefe';
		workbook.created = new Date();
		workbook.modified = new Date();

		const indexWorksheet = workbook.addWorksheet('Index', { properties: { tabColor: { argb: 'FF660000' }}});
		indexWorksheet.addRow(['Point d\'avancement']);
		indexWorksheet.addRow([]);
		indexWorksheet.addRow([]);
		indexWorksheet.addRow(['La colonne Projets offre une vue macro']);
		indexWorksheet.addRow(['La colonne Taches offre une vue micro']);
		indexWorksheet.addRow(['La colonne Statuts offre une vue meta']);

		const projectsWorksheet = workbook.addWorksheet('Projets');
		const projectsData = [];
		const projectMap = new Map();

		async function processTasks(tasks, projectMap) {
			for (const task of tasks) {
				const status = removeAccents(task.tab || 'Inconnu');
				const projectName = removeAccents(task.clean_description) || '';

				if (status === 'project' && !projectMap.has(projectName) && (!task.context || task.context.length === 0)) {
					projectMap.set(projectName, []);
				}

				if (projectMap.get(projectName))
					projectMap.get(projectName).push(task);
			}
		}

		processTasks(tasks, projectMap)
			.then(() => {
				return Promise.all(Array.from(projectMap).map(async ([projectName]) => {
					const avancement = await calculateProjectProgressAsync(projectName);

					if (avancement !== -1) {
						const projectRow = {
							Jalon: projectName,
							Avancement: avancement,
						};
						projectsData.push(projectRow);
					}
				}));
			})
			.then(() => {
				const projectsHeaders = [
					{ header: 'Projet (ou Jalon)', key: 'Jalon', width: 30 },
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

				worksheet.getCell('C1').alignment = { horizontal: 'center', vertical: 'middle' };
				worksheet.getCell('D1').alignment = { horizontal: 'right', vertical: 'middle' };
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

							cell.alignment = { wrapText: true };

							if (cell.address.includes('C')) {
								cell.alignment = { horizontal: 'center', vertical: 'middle' };
								cell.dataValidation = {
									type: 'list',
									formulae: ['"inbox,done,doc,await,delay,cancel"'],
									showDropDown: true,
								};
							}

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
					if (status !== 'project' && (!task.context || task.context.length === 0)) {
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

				const sourceWorksheet = workbook.addWorksheet('Audit', { properties: { tabColor: { argb: 'FF660000' }}});
				sourceWorksheet.mergeCells('A1:H1');
				sourceWorksheet.getCell('A1').font = { name: 'Courier New' };
				sourceWorksheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left' };
				sourceWorksheet.getCell('A1').border = {
					top: { style: 'thin' },
					left: { style: 'thin' },
					bottom: { style: 'thin' },
					right: { style: 'thin' },
				};
				sourceWorksheet.getCell('A1').fill = {
					type: 'pattern',
					pattern: 'solid',
					fgColor: { argb: 'FFFFFF' },
				};
				sourceWorksheet.getCell('A1').value = mainEditor.getValue();

				sourceWorksheet.mergeCells('A2:H2');
				sourceWorksheet.getCell('A2').value = 'Merci de copier le contenu de la cellule ci-dessus dans l\'editeur ci-dessous : ';
				sourceWorksheet.getCell('A2').alignment = { vertical: 'middle', horizontal: 'left' };
				sourceWorksheet.getCell('A2').border = {
					top: { style: 'thin' },
					left: { style: 'thin' },
					bottom: { style: 'thin' },
					right: { style: 'thin' },
				};
				sourceWorksheet.getCell('A2').fill = {
					type: 'pattern',
					pattern: 'solid',
					fgColor: { argb: 'FFFFFF' },
				};

				sourceWorksheet.mergeCells('A3:H3');
				sourceWorksheet.getCell('A3').value = 'https://guillaumefe.github.io/linrd2.0';
				sourceWorksheet.getCell('A3').alignment = { vertical: 'middle', horizontal: 'left' };
				sourceWorksheet.getCell('A3').border = {
					top: { style: 'thin' },
					left: { style: 'thin' },
					bottom: { style: 'thin' },
					right: { style: 'thin' },
				};
				sourceWorksheet.getCell('A3').fill = {
					type: 'pattern',
					pattern: 'solid',
					fgColor: { argb: 'FFFFFF' },
				};

				workbook.xlsx.writeBuffer().then((buffer) => {
					const blob = new Blob([buffer], {
						type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
					});
					saveAs(blob, 'pipeline.xlsx');
				});
			});
	}

	const exportButton = document.getElementById('exportExcelButton');
	exportButton.addEventListener('click', () => {
		exportToExcel(allTasks);
	});

	toggleEditor()

	function setTheme(theme) {
	  toggleTheme(theme)
	}
	
	document.addEventListener("DOMContentLoaded", async function () {

		const loadingWheel = document.getElementById("loading-wheel");

		function showElement(elementId) {
			var element = document.getElementById(elementId);
			if (element) {
				element.style.display = "block";
			}
		}
		
		function sha2(str) {

			// Hacher la chaîne d'entrée en utilisant SHA-256
			const hash = CryptoJS.SHA256(str);

			// Convertir le hachage en une chaîne hexadécimale
			return hash.toString(CryptoJS.enc.Hex);
		}

		function hideElement(elementId) {
			var element = document.getElementById(elementId);
			if (element) {
				element.style.display = "none";
			}
		}

		function storePin(pin) {
			var hashedPin = sha2(pin);
			localStorage.setItem("hashedPin", hashedPin);
		}

		function getStoredPin() {
			return localStorage.getItem("hashedPin");
		}

		async function unlockSession(enteredPin) {

		  if (typeof enteredPin !== 'string')
			enteredPin = document.getElementById("pinInput").value;
		
		  var storedPin = getStoredPin();

		  if (storedPin) {
			var hashedEnteredPin = sha2(enteredPin);
			if (hashedEnteredPin === storedPin) {
			  //alert("Code PIN correct. Vous êtes connecté.");
			  
				  // Code pour saveData()
				  user_password = enteredPin;

				  initialData = await loadData();

				// get v1 editor in localstorage
				initialData += "\n" + (await getEditorFromLocal() || "") + "\n"

				// get v2 editor in indexeddb
				initialData += "\n" + (await checkAndCopyEditorContent() || "") + "\n"
				
				if (! initialData.trim()) {
					landingPage.style.display = "flex";
				    const inputTask = document.getElementById("inputTask");
				    inputTask.focus();
				}
	
				mainEditor.session.insert({ row: 0, column: 0 }, initialData);
				mainEditor.session.foldAll();
				  

				let typingTimer;
				const delay = 1000; // Délai en millisecondes

				mainEditor.session.on("change", () => {
					// Réinitialisez le minuteur à chaque modification
					clearTimeout(typingTimer);
					document.getElementById("loadingOverlay").style.display = "flex";
					// Démarrez un nouveau minuteur
					typingTimer = setTimeout(() => {
						const content = mainEditor.getValue();
						generateTasks(content);
					}, delay);
				});	

				const content = mainEditor.getValue();
				generateTasks(content);
				regenerateTasks();				

			  // Appliquez la classe "fade-out" pour déclencher la transition de fondu
			  var splashContainer = document.querySelector(".splash-container");
			  var bkgContainer = document.querySelector(".background-container");

			  if (splashContainer) {
				splashContainer.classList.add("fade-out");
				bkgContainer.classList.add("fade-out");

				// Attendez la fin de la transition avant de masquer complètement les éléments
				setTimeout(() => {
				  splashContainer.style.display = "none";
				  bkgContainer.style.display = "none";
				}, 1500); // Assurez-vous que la durée ici correspond à celle que vous avez définie dans les règles CSS
			  }
			  
			} else {
			  alert("Code PIN incorrect. Veuillez réessayer.");
				const resetDataButton = document.getElementById("resetDataButton");
				resetDataButton.style.display = "block"; // Afficher le bouton de réinitialisation
				// Écoutez le clic sur le bouton de réinitialisation
				resetDataButton.addEventListener("click", function() {
					
				  confirm("This will wipe the current database. Continue? ");
				  
				  // Ouvrir la base de données "editorDB"
				  const request = indexedDB.open("editorDB");

				  request.onsuccess = function (event) {
					const db = event.target.result;

					// Ouvrir le store "editorStore" en mode de transaction en écriture
					const transaction = db.transaction(["editorStore"], "readwrite");
					const store = transaction.objectStore("editorStore");

					// Supprimer l'objet "editor-enc" du store "editorStore"
					store.delete("editor-enc").onsuccess = function () {
					  alert("La base de données a été supprimé. La session a été réinitialisée.");
					  location.reload()
					};

					resetDataButton.style.display = "none"; // Masquer à nouveau le bouton de réinitialisation
					transaction.oncomplete = function () {
					  db.close(); // Fermer la base de données
					};
				  };
				});
			}
		  } else {
			if (await isIndexedDBEmpty()) {
				alert("Aucun code PIN n'a été créé. Veuillez créer un code PIN.");
			} else {
				// Aucun code dans localstorage mais des données chiffrées existent en base 
				// Si j'ai fourni un code qui est capable de dechiffrer les données, je sauvegarde ce code 

				async function verifyDecryptionKey(password, encryptedData) {
				  try {
					const encryptedDataBuffer = new Uint8Array(encryptedData);
					const key = await deriveKeyFromPassword(password);
					// Tente de déchiffrer les données avec la clé fournie
					const decryptedDataBuffer = await crypto.subtle.decrypt(
					  { name: "AES-GCM", iv: new Uint8Array(12) },
					  key,
					  encryptedDataBuffer
					);

					// Si le déchiffrement réussit sans erreur, renvoie true
					return true;
				  } catch (error) {
					// Si une erreur se produit pendant le déchiffrement, affiche l'erreur
					console.error("Erreur de déchiffrement : " + error);
					return false;
				  }
				}

				// Ouvrir la base de données IndexedDB
				const dbName = "editorDB";
				const version = 1;
				// Ouvrir la base de données IndexedDB
				const db = await openDatabaseSync(dbName, version);
				
				const request = indexedDB.open("editorDB");

				request.onsuccess = function (event) {
					const db = event.target.result;

					// Ouvrir la transaction pour l'objet de stockage contenant les données chiffrées
					const transaction = db.transaction(["editorStore"], "readonly");
					const objectStore = transaction.objectStore("editorStore");

					// Récupérer la donnée chiffrée en fonction de la clé
					const getRequest = objectStore.get("editor-enc");

					getRequest.onsuccess = async function (event) {
						const encryptedData = event.target.result // Assurez-vous que "editorEnc" correspond au nom de l'attribut contenant les données chiffrées

						// Utilisez votre algorithme de chiffrement pour déchiffrer les données
						const decryptedData = await verifyDecryptionKey(enteredPin, encryptedData)

						if (decryptedData) {
							var hashedPin = sha2(enteredPin);
							localStorage.setItem("hashedPin", hashedPin);
							unlockSession(enteredPin)
						} else {
							alert("Code PIN incorrect. Veuillez réessayer.");
							const resetDataButton = document.getElementById("resetDataButton");
							resetDataButton.style.display = "block"; // Afficher le bouton de réinitialisation
							
							// Écoutez le clic sur le bouton de réinitialisation
							resetDataButton.addEventListener("click", function() {
							  // Ouvrir la base de données "editorDB"
							  const request = indexedDB.open("editorDB");

							  request.onsuccess = function (event) {
								const db = event.target.result;

								// Ouvrir le store "editorStore" en mode de transaction en écriture
								const transaction = db.transaction(["editorStore"], "readwrite");
								const store = transaction.objectStore("editorStore");

								// Supprimer l'objet "editor-enc" du store "editorStore"
								store.delete("editor-enc").onsuccess = function () {
								  alert("La base de données a été supprimé. La session a été réinitialisée.");
								  location.reload()
								};

								resetDataButton.style.display = "none"; // Masquer à nouveau le bouton de réinitialisation
								transaction.oncomplete = function () {
								  db.close(); // Fermer la base de données
								};
							  };
							});
						}
					};
				};
			}
		  }
		}

	// Utilisez la bibliothèque crypto-js pour générer un hash du PIN
	function hashPin(pin) {
		var hashedPin = CryptoJS.SHA256(pin).toString();
		return hashedPin;
	}


function createPin(event) {
	
    var pinCreateForm = document.getElementById("pinCreationForm");
    var pinConfirmForm = document.getElementById("pinConfirmationForm");

    var pinCreateInput = document.getElementById("pinCreateInput");
    var pinConfirmButton = document.getElementById("pinConfirmButton");
    var pinConfirmField = document.getElementById("pinConfirmInput");

    var pinToHash = pinCreateInput.value;

    if (pinToHash.length < 6) {
        alert("The PIN code must contain at least 6 characters.");
        return;
    }

    var hashedPin = hashPin(pinToHash);

    var pinCreateButton = document.getElementById("pinCreateButton");
    pinCreateButton.style.display = "none"; // Masquez le bouton de création

    pinCreateForm.style.display = "none"; // Masquez le formulaire de création

    pinConfirmForm.style.display = "block"; // Affichez le formulaire de confirmation
    pinConfirmButton.addEventListener("click", confirmPin);
    pinConfirmField.focus();

    // Stockez le hash du PIN dans la balise data de pinConfirmationForm
    pinConfirmForm.dataset.pinHash = hashedPin;
	
}

function confirmPin() {
    var enteredPin = document.getElementById("pinConfirmInput").value;
    var pinConfirmForm = document.getElementById("pinConfirmationForm");
    var hashedPin = pinConfirmForm.dataset.pinHash;

    if (hashPin(enteredPin) !== hashedPin) {
        alert("The second PIN code does not match the first. Please try again.");
        return;
    }

    storePin(enteredPin);
    
    var splashContainer = document.querySelector(".splash-container");
    var bkgContainer = document.querySelector(".background-container");

    if (splashContainer) {
        splashContainer.classList.add("fade-out");
        bkgContainer.classList.add("fade-out");

        setTimeout(() => {
            splashContainer.style.display = "none";
            bkgContainer.style.display = "none";
        }, 1500);
    }
	
	unlockSession(enteredPin)
    // Détruire  le hash du PIN dans la balise data de pinConfirmationForm
    pinConfirmForm.dataset.pinHash = "";
}



//})()

async function checkAndCopyEditorContent() {
  const dbName = "editorDB";
  const version = 1;

  try {
    // Ouvrir la base de données IndexedDB
    const db = await openDatabaseSync(dbName, version);

    // Vérifier si "editor" peut exister
    const isEmpty = await isIndexedDBEmptyBackupPreviousLinrd(db);

    if (!isEmpty) {
      // "editor" peut déjà exister dans la base de données

      // Copiez le contenu et insérez-le en haut de l'éditeur Ace
      const transaction = db.transaction(["editorStore"], "readwrite");
      const store = transaction.objectStore("editorStore");

      // Vérifier si "editor" existe dans la base de données
      return new Promise((resolve, reject) => {
        const request = store.get("editor");

        request.onsuccess = async (event) => {
          const data = event.target.result;
          let parsedData = "";

          try {
            // Parser le contenu en JSON
            parsedData = JSON.parse(data);
			parsedData = parsedData.map((task) => task.description).join("\n");
          } catch (error) {
			  try {
				  parsedData = JSON.parse(data);
			  } catch (e) {
				console.error("Erreur lors de la lecture et du parsing des données de l'éditeur :", error);
				parsedData = data;
			  }
          }

          // Si "editor" existe dans la base de données
          if (parsedData) {
            // Supprimer l'attribut "editor" de l'object store
            const deleteRequest = store.delete("editor");

            deleteRequest.onsuccess = () => {
              resolve(parsedData);
            };

            deleteRequest.onerror = (event) => {
              reject(event.target.error);
            };
          } else {
            resolve(""); // Renvoyer une chaîne vide
          }
        };

        request.onerror = (event) => {
          reject(event.target.error);
        };
      });
    } else {
      // L'attribut "editor" n'existe pas
      return ""; // Renvoyer une chaîne vide
    }

    // Fermez la base de données
    db.close();
  } catch (error) {
    console.error("Erreur lors de la vérification et de la copie de l'éditeur :", error);
    return ""; // Renvoyer une chaîne vide en cas d'erreur
  }
}

async function getEditorFromLocal(previous_data) {
	// Vérifier si l'objet "editor" existe dans le local storage
	const editorData = localStorage.getItem("editor");

	if (editorData) {
	  let parsedData = "";
	  
		// Parser le contenu en JSON
		try {
			parsedData = JSON.parse(editorData);
			parsedData = parsedData.map((task) => task.description).join("\n");
		} catch(error) {
			try {
				parsedData = JSON.parse(editorData);
			} catch (e) {
				console.error("Erreur lors de la lecture et du parsing des données de l'éditeur :", error);
				parsedData = editorData;
			}
		}
	  
	  if (parsedData) {
			// Insérer le contenu du local storage au début de l'éditeur Ace
			//mainEditor.session.insert({ row: 0, column: 0 }, "\n" + parsedData + "\n");
			
			// Supprimer l'objet "editor" du local storage
			localStorage.removeItem("editor");
	  }
	
	 return parsedData;
	
	}
}


	var storedPin = getStoredPin();
	var pinUnlockButton = document.getElementById("pinUnlockButton");
	var pinCreateButton = document.getElementById("pinCreateButton");
	var pinConfirmButton = document.getElementById("pinConfirmButton");
	var pinUnlockField = document.getElementById("pinInput");
	var pinCreateField = document.getElementById("pinCreateInput");
	var pinConfirmField = document.getElementById("pinConfirmInput");


// Recuperate previous linrd versions

	
	setTimeout(() => loadingWheel.style.display = "none", 1000);
	
	// Écoutez la touche "Entrée" pressée sur l'élément d'entrée
	pinUnlockField.addEventListener("keydown", function(event) {
	  if (event.key === "Enter" && pinUnlockField.style.display !== "none") {
		// Si la touche "Entrée" est pressée et le bouton est affiché
	event.preventDefault()
	event.stopPropagation()
		pinUnlockButton.click(); // Déclencher le clic du bouton 
	  }
	});
	pinCreateField.addEventListener("keydown", function(event) {
	  if (event.key === "Enter" && pinCreateField.style.display !== "none") {
		// Si la touche "Entrée" est pressée et le bouton est affiché
	event.preventDefault()
	event.stopPropagation()
		pinCreateButton.click(); // Déclencher le clic du bouton
	  }
	});

	pinConfirmField.addEventListener("keydown", function(event) {
	  if (event.key === "Enter" && pinConfirmField.style.display !== "none") {
		// Si la touche "Entrée" est pressée et le bouton est affiché
	event.preventDefault()
	event.stopPropagation()
		pinConfirmButton.click(); // Déclencher le clic du bouton
	  }
	});


	
	const landingPage = document.getElementById("landingPage");
	landingPage.style.display = "none";
	
	const inputTask = document.getElementById("inputTask");
	inputTask.value = "";
	
	inputTask.addEventListener("input", function () {
		const inputLength = inputTask.value.length;

		if (inputLength >= 0) {
			const intensity = 1 - (inputLength - 1) * 0.00005;
			landingPage.style.backgroundColor = `rgba(255, 255, 255, ${intensity})`;
			
			if (intensity <= 0) {
				// Supprime l'élément de la page lorsque l'opacité atteint 0%
				landingPage.remove();
				mainEditor.gotoLine(0, Infinity, true);
				mainEditor.focus();
			}
		}
		const firstLineRange = mainEditor.session.getLine(0).length;
		mainEditor.session.replace({ start: { row: 0, column: 0 }, end: { row: 0, column: firstLineRange } }, inputTask.value);
	});
	inputTask.addEventListener("keydown", function (e) {
		if (e.key === "Enter" || e.key === "Escape") {
			// Supprime l'élément de la page lorsque l'utilisateur appuie sur Entrée
			mainEditor.focus();
			mainEditor.gotoLine(1, Infinity, true);
			landingPage.remove();
		}
	});


	if (! await isIndexedDBEmpty()) {
		showElement("pinUnlockForm");
		hideElement("pinCreationForm");
		
		pinUnlockField.focus();
		if (pinUnlockButton) {
			pinUnlockButton.addEventListener("click", () => {
				unlockSession();
			});
		}
	} else {
		showElement("pinCreationForm");
		hideElement("pinUnlockForm");
		
		
		pinCreateField.focus();
		
		pinCreateButton.addEventListener("click", createPin);

		if (pinConfirmButton) {
			// Écoutez la touche "Entrée" pressée sur l'élément d'entrée
			pinConfirmButton.addEventListener("click", confirmPin);
		}
	}
	
// Fonction pour charger le thème actuel depuis localStorage
function loadTheme() {
    const editorTheme = localStorage.getItem('editorTheme');

    if (editorTheme === 'ace/theme/monokai') {
        activateDarkMode();
    } else {
        activateLightMode();
    }
}

loadTheme();
});
