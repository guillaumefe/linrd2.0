#### updateTaskStatus(task, newStatusSymbol)

```
function updateTaskStatus(task, newStatusSymbol) {
  const lines = mainEditor.session.doc.getAllLines();
  const taskLineIndex = parseInt(task.id || task.target.dataset.task_id) - 1;
  let taskLine = lines[taskLineIndex];
  const currentStatusSymbol = getStatusSymbol(taskLine);
  
  // Supprimer tous les symboles de statut existants dans la description
  taskLine = taskLine.replace(/(-|\+|&|x|\*)-$/g, '').trimEnd();
  lines[taskLineIndex] = taskLine.replace(taskLine, `${taskLine} ${newStatusSymbol}`);
  mainEditor.session.doc.setValue(lines.join("\n"));
  
}
```

#### Description :
La fonction updateTaskStatus est utilisée pour mettre à jour le symbole de statut d'une tâche dans l'éditeur. Elle prend en paramètres la tâche à mettre à jour et le nouveau symbole de statut.

#### Fonctionnement technique :

La fonction commence par récupérer toutes les lignes du document de l'éditeur.
Elle détermine l'index de la ligne de la tâche à partir de l'ID de la tâche fourni.
Ensuite, elle récupère la ligne de la tâche à partir de l'index.
La fonction utilise la fonction getStatusSymbol pour obtenir le symbole de statut actuel de la tâche.
Elle supprime tous les symboles de statut existants à la fin de la ligne de la tâche.
Ensuite, elle ajoute le nouveau symbole de statut à la fin de la ligne.
La ligne mise à jour est réinsérée dans le tableau des lignes.
Enfin, la valeur du document de l'éditeur est mise à jour en rejoignant toutes les lignes avec un saut de ligne.

#### Exemples d'utilisation :

Mettre à jour le statut d'une tâche avec le symbole "+" :

```javascript
const task = { id: 1 }; // Tâche à mettre à jour
updateTaskStatus(task, '+'); // Mettre à jour le statut avec le symbole "+"
```

Mettre à jour le statut d'une tâche avec le symbole "*" :

```javascript
const task = { target: { dataset: { task_id: 2 } } }; // Tâche à mettre à jour
updateTaskStatus(task, '*'); // Mettre à jour le statut avec le symbole "*"
```
#### Note : 
Assurez-vous d'avoir une instance valide de l'éditeur et que la fonction getStatusSymbol est définie correctement pour que la fonction updateTaskStatus fonctionne comme prévu.
