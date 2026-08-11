import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  englishFacingTopic,
  translateRussianTopicToEnglish,
} from "./kb-text-locale.ts";

describe("KB Russian → English topic translation", () => {
  it("translates corporate ethics (not transliteration)", () => {
    assert.equal(translateRussianTopicToEnglish("Корпоративная Этика"), "Corporate Ethics");
    assert.doesNotMatch(
      translateRussianTopicToEnglish("Корпоративная Этика"),
      /Korporativ/i,
    );
  });

  it("translates healthy team atmosphere", () => {
    assert.equal(
      translateRussianTopicToEnglish("Здоровая атмосфера в коллективе"),
      "Healthy Atmosphere in the Team",
    );
  });

  it("englishFacingTopic uses translation for Cyrillic", () => {
    assert.equal(englishFacingTopic("Рабочая этика"), "Work Ethics");
  });

  it("englishFacingTopic fixes transliterated Russian titles", () => {
    assert.equal(
      englishFacingTopic("Zdorovaya Atmosfera V Kollektive"),
      "Healthy Atmosphere in the Team",
    );
    assert.equal(
      englishFacingTopic("Korporativnaya Etika"),
      "Corporate Ethics",
    );
    assert.equal(
      englishFacingTopic("Zabota O Zdorove Sotrudnikov"),
      "Employee Health Care",
    );
  });
});
