/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testTimeout: 10000,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    // Fixes "import outside scope" from expo winter runtime in node env
    'expo/src/winter/(.*)': '<rootDir>/tests/mocks/emptyMock.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(.pnpm|(jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|native-base|react-native-svg|react-native-logs))',
  ],
};
