module.exports = {
  apps: [
    {
      name: 'xteink-gallery',
      script: 'index.js',
      watch: false,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
