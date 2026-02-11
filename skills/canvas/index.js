export { listCourses, getCourse } from './courses.js';
export { listAssignments, getAssignment, getUpcomingAssignments } from './assignments.js';
export { listPages, getPage } from './pages.js';
export { listDiscussions, getDiscussion, getDiscussionEntries } from './discussions.js';
export { syncAssignmentsToNotion } from './sync.js';

export default {
  name: 'CanvasSkill',
  description: 'Read course content from Canvas LMS',
  functions: {
    listCourses: (await import('./courses.js')).listCourses,
    getCourse: (await import('./courses.js')).getCourse,
    listAssignments: (await import('./assignments.js')).listAssignments,
    getAssignment: (await import('./assignments.js')).getAssignment,
    getUpcomingAssignments: (await import('./assignments.js')).getUpcomingAssignments,
    listPages: (await import('./pages.js')).listPages,
    getPage: (await import('./pages.js')).getPage,
    listDiscussions: (await import('./discussions.js')).listDiscussions,
    getDiscussion: (await import('./discussions.js')).getDiscussion,
    getDiscussionEntries: (await import('./discussions.js')).getDiscussionEntries,
    syncAssignmentsToNotion: (await import('./sync.js')).syncAssignmentsToNotion,
  },
};
