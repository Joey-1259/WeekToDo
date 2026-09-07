export default {
    open() {
        var req = indexedDB.open('weekToDo', 6);
        req.onupgradeneeded = function (event) {
            var db = event.target.result;
            if (!db.objectStoreNames.contains("todo_lists")) {
                db.createObjectStore('todo_lists', {autoIncrement: false});
            }

            if (!db.objectStoreNames.contains("repeating_events")) {
                db.createObjectStore('repeating_events', {autoIncrement: false});
            }

            if (!db.objectStoreNames.contains("repeating_events_by_date")) {
                db.createObjectStore('repeating_events_by_date', {autoIncrement: false});
            }

            if (!db.objectStoreNames.contains("focus_documents")) {
                const store = db.createObjectStore(
                    "focus_documents",
                    { autoIncrement: false }
                );
                store.createIndex(
                    "updatedAt",
                    "updatedAt",
                    { unique: false }
                );
                store.createIndex(
                    "lastOpenedAt",
                    "lastOpenedAt",
                    { unique: false }
                );
                store.createIndex(
                    "archivedAt",
                    "archivedAt",
                    { unique: false }
                );
                store.createIndex(
                    "deletedAt",
                    "deletedAt",
                    { unique: false }
                );
            }

            if (!db.objectStoreNames.contains("focus_tags")) {
                const store = db.createObjectStore(
                    "focus_tags",
                    { autoIncrement: false }
                );
                store.createIndex(
                    "normalizedName",
                    "normalizedName",
                    { unique: true }
                );
            }

            if (!db.objectStoreNames.contains("focus_task_links")) {
                const store = db.createObjectStore(
                    "focus_task_links",
                    { autoIncrement: false }
                );
                store.createIndex(
                    "documentId",
                    "documentId",
                    { unique: false }
                );
                store.createIndex(
                    "taskId",
                    "taskId",
                    { unique: false }
                );
                store.createIndex(
                    "blockId",
                    "blockId",
                    { unique: false }
                );
                store.createIndex(
                    "status",
                    "status",
                    { unique: false }
                );
            }

            if (!db.objectStoreNames.contains("focus_document_revisions")) {
                const store = db.createObjectStore(
                    "focus_document_revisions",
                    { autoIncrement: false }
                );
                store.createIndex(
                    "documentId",
                    "documentId",
                    { unique: false }
                );
                store.createIndex(
                    "createdAt",
                    "createdAt",
                    { unique: false }
                );
            }

            /* FOCUS_RICH_CONTENT_SYSTEM_20260907_V1 */
            if (!db.objectStoreNames.contains("focus_assets")) {
                const store = db.createObjectStore(
                    "focus_assets",
                    { autoIncrement: false }
                );
                store.createIndex(
                    "documentId",
                    "documentId",
                    { unique: false }
                );
                store.createIndex(
                    "createdAt",
                    "createdAt",
                    { unique: false }
                );
            }
        }
        req.onerror = function (event) {
            console.log('error opening database ' + event.target.errorCode);
        }
        return req;
    },
    get(db, table, id) {
        let tx = db.transaction([table], 'readonly');
        let store = tx.objectStore(table);
        let req = store.get(id);
        return req;
    },
    add(db, table, id, obj) {
        let tx = db.transaction([table], 'readwrite');
        let store = tx.objectStore(table);
        let req = store.add(obj, id);
        return req;
    },
    update(db, table, id, obj) {
        let tx = db.transaction([table], 'readwrite');
        let store = tx.objectStore(table);
        let new_obj = JSON.parse(JSON.stringify(obj));
        let req = store.put(new_obj,id);
        return req;
    },
    delete(db, table, id) {
        let tx = db.transaction([table], 'readwrite');
        let store = tx.objectStore(table);
        let req = store.delete(id);
        return req;
    },
    selectAll(db, table){
        let tx = db.transaction([table], 'readwrite');
        let store = tx.objectStore(table);
        let req = store.openCursor();
        return req;
    },
    clear(db, table){
        let tx = db.transaction([table], 'readwrite');
        let store = tx.objectStore(table);
        let req = store.clear();
        return req;
    }
};
