import moment from "moment";

export default {
  refreshDayNotifications(vue, todoListId) {
    let todoList = vue.$store.getters.todoLists[todoListId];
    var notificationSound = vue.$store.getters.config.notificationSound;
    if (todoListId != moment().format("YYYYMMDD")) return;

    vue.$store.getters.notifications.forEach((notification) => {
      clearTimeout(notification);
    });
    var notificationsList = [];

    if (todoList != null)
      todoList.forEach((todo) => {
        if (!todo.time || todo.checked) return;

        // 兼容策略：新数据用 reminders（分钟偏移数组，0 表示到点提醒）；
        // 老数据没有 reminders 字段时，退回到原来的单一 alarm 布尔行为，
        // 等效于 reminders:[0]，不需要跑批量迁移脚本改历史数据。
        let reminderOffsets;
        if (Array.isArray(todo.reminders) && todo.reminders.length) {
          reminderOffsets = todo.reminders;
        } else if (todo.alarm) {
          reminderOffsets = [0];
        } else {
          reminderOffsets = [];
        }

        reminderOffsets.forEach((offsetMinutes) => {
          let fireMoment = moment(todo.time, "HH:mm").subtract(offsetMinutes, "minutes");
          if (fireMoment >= moment()) {
            notificationsList.push(this.createNotificationAlert(fireMoment.format("HH:mm"), todo.text, notificationSound));
          }
        });
      });

    vue.$store.commit("setNotificatios", notificationsList);
  },
  createNotificationAlert(todoTime, todoText, notificationSound) {
    var x = new moment();
    var y = new moment(todoTime, "HH:mm");
    var duration = moment.duration(y.diff(x)).asMilliseconds();

    var alertTimeOut = setTimeout(
      function () {
        this.createNotification(moment(todoTime, "HH:mm").format("LT"), todoText, notificationSound);
      }.bind(this),
      duration
    );

    return alertTimeOut;
  },
  createNotification(header, body, notificationSound) {
    new Notification(header, {
      body: body,
      icon: "/favicon.ico",
      silent: true,
    });
    this.playNotificationSound(notificationSound);
  },
  playNotificationSound(notificationSound) {
    var sound;
    switch (notificationSound) {
      case "pop":
        sound = new Audio("sounds/pop-alert.ogg");
        break;
      case "positive":
        sound = new Audio("sounds/positive.ogg");
        break;
      case "bell":
        sound = new Audio("sounds/loud-bell.ogg");
        break;
      case "soft":
        sound = new Audio("sounds/soft.ogg");
        break;
      case "tiny":
        sound = new Audio("sounds/tiny.ogg");
        break;
      case "piano":
        sound = new Audio("sounds/piano.ogg");
        break;
      case "soft-bell":
        sound = new Audio("sounds/soft-bell.ogg");
        break;
      case "metal":
        sound = new Audio("sounds/metal-gear.ogg");
        break;
      case "none":
        return;
    }
    sound.addEventListener("canplaythrough", () => {
      sound.play();
    });
  },
};
