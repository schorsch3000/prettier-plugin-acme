"use strict";

/** @type {import("prettier").Config} */
module.exports = {
  plugins: ["./index.js"],
  overrides: [
    {
      files: ["*.asm", "*.a"],
      options: {
        parser: "acme",
      },
    },
  ],
};

