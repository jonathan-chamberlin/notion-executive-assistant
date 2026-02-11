export { listRepos, getRepo, createRepo } from './repos.js';
export { listIssues, createIssue, updateIssue, closeIssue } from './issues.js';
export { listPulls, createPull, mergePull, confirmAction } from './pulls.js';
export { readFile, writeFile, deleteFile } from './files.js';
export { listBranches, createBranch, deleteBranch } from './branches.js';

export default {
  name: 'GitHubSkill',
  description: 'Manage GitHub repositories, pull requests, issues, branches, and files',
  functions: {
    listRepos: (await import('./repos.js')).listRepos,
    getRepo: (await import('./repos.js')).getRepo,
    createRepo: (await import('./repos.js')).createRepo,
    listIssues: (await import('./issues.js')).listIssues,
    createIssue: (await import('./issues.js')).createIssue,
    updateIssue: (await import('./issues.js')).updateIssue,
    closeIssue: (await import('./issues.js')).closeIssue,
    listPulls: (await import('./pulls.js')).listPulls,
    createPull: (await import('./pulls.js')).createPull,
    mergePull: (await import('./pulls.js')).mergePull,
    confirmAction: (await import('./pulls.js')).confirmAction,
    readFile: (await import('./files.js')).readFile,
    writeFile: (await import('./files.js')).writeFile,
    deleteFile: (await import('./files.js')).deleteFile,
    listBranches: (await import('./branches.js')).listBranches,
    createBranch: (await import('./branches.js')).createBranch,
    deleteBranch: (await import('./branches.js')).deleteBranch,
  },
};
