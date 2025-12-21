import 'dotenv/config';

console.log('LLM Defaults:');
console.log('DEFAULT_LLM_MODEL:', process.env.DEFAULT_LLM_MODEL || 'not set');
console.log('DEFAULT_EMBEDDING_MODEL:', process.env.DEFAULT_EMBEDDING_MODEL || 'not set');
console.log('LLM_TEMPERATURE:', process.env.LLM_TEMPERATURE || 'not set');
console.log('LLM_MAX_TOKENS:', process.env.LLM_MAX_TOKENS || 'not set');
