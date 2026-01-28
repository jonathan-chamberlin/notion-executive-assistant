export { queryTasks, tasksToday, tasksYesterday, tasksTomorrow } from './query.js';
export { createTask } from './create.js';
export { updateTask, completeTask } from './update.js';
export { searchTasks } from './search.js';

export default {
  name: 'NotionSkill',
  description: 'Manage tasks in Notion',
  functions: {
    queryTasks: (await import('./query.js')).queryTasks,
    tasksToday: (await import('./query.js')).tasksToday,
    tasksYesterday: (await import('./query.js')).tasksYesterday,
    tasksTomorrow: (await import('./query.js')).tasksTomorrow,
    createTask: (await import('./create.js')).createTask,
    updateTask: (await import('./update.js')).updateTask,
    completeTask: (await import('./update.js')).completeTask,
    searchTasks: (await import('./search.js')).searchTasks,
  },
};
