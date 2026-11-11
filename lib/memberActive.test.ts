import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isMemberActive, membersForRegistrationRoster } from "./memberActive";

describe("isMemberActive", () => {
  it("treats true and missing as active", () => {
    assert.equal(isMemberActive({ isActive: true }), true);
    assert.equal(isMemberActive({ isActive: undefined as unknown as boolean }), true);
  });

  it("treats false as inactive", () => {
    assert.equal(isMemberActive({ isActive: false }), false);
  });
});

describe("membersForRegistrationRoster", () => {
  const members = [
    { id: 1, isActive: true },
    { id: 2, isActive: false },
    { id: 3, isActive: false },
  ];

  it("hides inactive members who are not registered", () => {
    assert.deepEqual(
      membersForRegistrationRoster(members, [2]),
      [
        { id: 1, isActive: true },
        { id: 2, isActive: false },
      ]
    );
  });

  it("shows only active when nobody is registered", () => {
    assert.deepEqual(membersForRegistrationRoster(members, []), [
      { id: 1, isActive: true },
    ]);
  });
});
