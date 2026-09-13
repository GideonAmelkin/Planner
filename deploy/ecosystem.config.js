// pm2 config for the Planner backend on RT100.
// Start with:  pm2 start /home/gamelkin/apps/planner/deploy/ecosystem.config.js
// PORT / FRONTEND_URL / BACKEND_URL / OAuth secrets are loaded from backend/.env via dotenv.
module.exports = {
  apps: [
    {
      name: 'planner-backend',
      cwd: '/home/gamelkin/apps/planner/backend',
      script: 'server.js',
      env: { NODE_ENV: 'production' },
    },
  ],
};
