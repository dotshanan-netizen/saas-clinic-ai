const lib = require('libphonenumber-js');
console.log(Object.keys(lib));
console.log("parsePhoneNumberFromString typeof:", typeof lib.parsePhoneNumberFromString);

const { parsePhoneNumberFromString } = lib;
try {
  const p = parsePhoneNumberFromString("+966551234567");
  console.log("Parsed:", p?.country);
} catch(e) {
  console.log("Error in CJS:", e.message);
}
