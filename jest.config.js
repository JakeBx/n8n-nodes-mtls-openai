/** @type {import('jest').Config} */
const config = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	roots: ['<rootDir>/__tests__'],
	testMatch: ['**/*.test.ts'],
	moduleFileExtensions: ['ts', 'js', 'json'],
};

module.exports = config;
