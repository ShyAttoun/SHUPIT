module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/test/setupEnv.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^firebase/.*$': '<rootDir>/test/firebaseStub.js',
    '^@react-native-async-storage/async-storage$': '<rootDir>/test/firebaseStub.js',
  },
};
