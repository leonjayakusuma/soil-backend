import bcrypt from 'bcrypt';

async function test() {
  const plain = 'a';
  const hash = '$2b$10$VsYhogHpjYxDPA.6lrIOgOCgYIFZh7Y6bEg1hpinXTOHpFOb..ifm';
  const match = await bcrypt.compare(plain, hash);
  console.log('match?', match);
}

test().catch(console.error);