const bcrypt = require("bcrypt");

const hash = "$2b$10$zo7zCJUfWuV3fM4UD5SCl.HVJpPGCu.DqkzwGKVmkhSuCP8L4XLm6";

bcrypt.compare("TestingPass", hash)
.then(res => console.log(res)); // true or false
