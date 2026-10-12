import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import { Platform } from 'react-native';
import { candyStore } from '../store/candyStore';
import { RoutineTaskService } from './routineTaskService';
import log from './logger';

export const setupNotificationHandler = async () => {
  // 1. Set notification handler
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    } as Notifications.NotificationBehavior),
  });

  // 2. Request permissions
  await registerForPushNotificationsAsync();

  // 3. Set Android channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  // 4. Set notification category
  await Notifications.setNotificationCategoryAsync('routine-task-actions', [
    {
      identifier: 'finish',
      buttonTitle: 'Finish',
      options: {
        opensAppToForeground: true,
      },
    },
    {
      identifier: 'ignore',
      buttonTitle: 'Ignore',
      options: {
        opensAppToForeground: false,
      },
    },
  ]);

  // 5. Add notification response listener
  Notifications.addNotificationResponseReceivedListener(response => {
    const actionIdentifier = response.actionIdentifier;
    const taskId = response.notification.request.content.data?.taskId;
    if (typeof taskId !== "string") {
      return;
    }

    if (actionIdentifier === 'finish') {
      RoutineTaskService.finishRoutineTask(taskId);
    } else if (actionIdentifier === 'ignore') {
      log.info(`Ignore action handled for task: ${taskId}`);
    }
  });
};

export const scheduleNotificationsForRoutineTasks = async () => {
  const routineTasks = await RoutineTaskService.getFilteredRoutineTasks(
    candyStore.getState().routineTasks
  );
  
  const reminderTime = RoutineTaskService.getDailyReminderTime();

  // Cancel all previously scheduled notifications to avoid duplicates
  await Notifications.cancelAllScheduledNotificationsAsync();

  for (const task of routineTasks) {
    if (task.isDone) {
      continue; // Skip completed tasks
    }

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Routine Task Reminder",
          body: task.label,
          data: { taskId: task.id },
          categoryIdentifier: 'routine-task-actions',
        },
        // trigger: { type: SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 10, repeats: true },
        trigger: { type: SchedulableTriggerInputTypes.DAILY, hour: reminderTime?.getHours() ?? 8, minute: reminderTime?.getMinutes() ?? 0 },
      });
      log.info(`Notification scheduled for task: ${task.label} at ${reminderTime?.getHours()}:${reminderTime?.getMinutes()}`);
    } catch (error) {
      log.error(`Failed to schedule notification for task: ${task.label}`, error);
    }
  }
};

export async function registerForPushNotificationsAsync() {
  let token;
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    alert('Failed to get push token for push notification!');
    return;
  }
  token = (await Notifications.getExpoPushTokenAsync()).data;
  log.info(`Push token generated: ${token}`);

  return token;
}