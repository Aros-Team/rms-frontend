process.env.CHROME_BIN = require('puppeteer').executablePath();

module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-coverage'),
      require('@angular-devkit/build-angular/plugins/karma'),
    ],
    client: {
      jasmine: {
        random: false,
      },
      clearContext: false,
    },
    coverageReporter: {
      dir: require('path').join(__dirname, './coverage/rms-frontend'),
      subdir: '.',
      reporters: [{ type: 'html' }, { type: 'text-summary' }],
    },
    customLaunchers: {
      ChromeHeadlessCI: {
        base: 'ChromeHeadless',
        flags: ['--headless=new', '--disable-gpu', '--no-sandbox'],
      },
    },
    reporters: ['progress'],
    browsers: ['ChromeHeadlessCI'],
    browserNoActivityTimeout: 120000,
    singleRun: true,
    restartOnFileChange: false,
  });
};
