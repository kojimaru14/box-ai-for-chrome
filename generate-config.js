import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const config = {
  clientId: process.env.BOX__CLIENT_ID,
  clientSecret: process.env.BOX__CLIENT_SECRET,
};

fs.writeFileSync('./public/config.json', JSON.stringify(config, null, 2));

console.log('✅ Config file generated: public/config.json');
