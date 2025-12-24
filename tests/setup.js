// Minimal test setup for integration tests
process.env.DOTENV_CONFIG_PATH = process.env.DOTENV_CONFIG_PATH || '.env.local';
require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH });
