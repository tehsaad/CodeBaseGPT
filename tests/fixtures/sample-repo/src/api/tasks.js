const { readSession } = require("../auth/session");

class TaskController {
  constructor(store) {
    this.store = store;
  }

  list(token) {
    const session = readSession(token);
    if (!session) throw new Error("Unauthorized");
    return this.store.filter((t) => t.ownerId === session.userId);
  }
}

module.exports = { TaskController };
