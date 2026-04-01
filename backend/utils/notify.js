const Notification = require("../models/Notification");

const createNotification = async ({
  userId,
  title,
  message,
  type = "general",
  meta = {},
}) => {
  if (!userId || !title || !message) {
    return null;
  }

  try {
    return await Notification.create({
      userId,
      title,
      message,
      type,
      meta,
    });
  } catch (error) {
    return null;
  }
};

const createBulkNotifications = async (items = []) => {
  const validItems = items.filter(
    (item) => item.userId && item.title && item.message
  );

  if (!validItems.length) return [];
  try {
    return await Notification.insertMany(validItems);
  } catch (error) {
    return [];
  }
};

module.exports = {
  createNotification,
  createBulkNotifications,
};
