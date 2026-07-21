const phone = "05294163275";
const clean = phone.replace(/[\s-]/g, "");
const match = clean.match(/(?<!\d)(?:\+?966|0)?5\d{8}(?!\d)/);
console.log("Match:", match);
