import { expect } from "chai";
import { validateAvatarConfig, clampScore } from "../lib/server/web";
import { DEFAULT_AVATAR } from "../lib/catalogItems";

const owned = [
  { id: 1001, category: "hats" },
  { id: 1002, category: "hats" },
  { id: 1010, category: "faces" },
  { id: 1011, category: "faces" },
  { id: 1015, category: "shirts" },
  { id: 1020, category: "pants" },
  { id: 1030, category: "gear" },
];

const baseConfig = () => JSON.parse(JSON.stringify(DEFAULT_AVATAR));

describe("web game score validation", () => {
  it("accepts sane scores and rejects garbage", () => {
    expect(clampScore(0)).eq(0);
    expect(clampScore(12345)).eq(12345);
    expect(clampScore("99")).eq(99);
    expect(clampScore(12.7)).eq(12);
    expect(clampScore(-1)).eq(null);
    expect(clampScore(10000001)).eq(null);
    expect(clampScore("abc")).eq(null);
    expect(clampScore(undefined)).eq(null);
  });
});

describe("avatar config validation", () => {
  it("accepts a valid config with owned items", () => {
    const config = baseConfig();
    config.hatIds = [1001, 1002];
    config.faceId = 1011;
    config.shirtId = 1015;
    config.pantsId = 1020;
    config.gearId = 1030;
    const r = validateAvatarConfig(config, owned);
    expect(r.ok).eq(true);
    expect(r.config.hatIds).deep.eq([1001, 1002]);
    expect(r.config.faceId).eq(1011);
    expect(r.config.shirtId).eq(1015);
    expect(r.config.pantsId).eq(1020);
    expect(r.config.gearId).eq(1030);
  });

  it("rejects equipping unowned items", () => {
    const config = baseConfig();
    config.faceId = 1012; // not owned
    const r = validateAvatarConfig(config, owned);
    expect(r.ok).eq(false);
    expect(r.error).to.match(/do not own/i);
  });

  it("rejects equipping an item in the wrong slot", () => {
    const config = baseConfig();
    config.shirtId = 1001; // a hat, not a shirt
    const r = validateAvatarConfig(config, owned);
    expect(r.ok).eq(false);
    expect(r.error).to.match(/not a shirt/i);
  });

  it("rejects more than 3 hats", () => {
    const config = baseConfig();
    config.hatIds = [1001, 1002, 1001, 1002];
    const r = validateAvatarConfig(config, owned);
    expect(r.ok).eq(false);
    expect(r.error).to.match(/3 hats/i);
  });

  it("rejects invalid body colors", () => {
    const config = baseConfig();
    config.bodyColors.torso = "blue";
    const r = validateAvatarConfig(config, owned);
    expect(r.ok).eq(false);
    expect(r.error).to.match(/body color/i);
  });

  it("normalizes colors and drops duplicates", () => {
    const config = baseConfig();
    config.bodyColors.head = "#FFCC00";
    config.hatIds = [1001, 1001];
    const r = validateAvatarConfig(config, owned);
    expect(r.ok).eq(true);
    expect(r.config.bodyColors.head).eq("#ffcc00");
    expect(r.config.hatIds).deep.eq([1001]);
  });

  it("always allows the default starter face even when not purchased", () => {
    const config = baseConfig();
    config.faceId = 1010;
    const r = validateAvatarConfig(config, [{ id: 1001, category: "hats" }]);
    expect(r.ok).eq(false); // strict list does not include 1010
    const r2 = validateAvatarConfig(config, [
      { id: 1001, category: "hats" },
      { id: 1010, category: "faces" },
    ]);
    expect(r2.ok).eq(true);
  });
});
