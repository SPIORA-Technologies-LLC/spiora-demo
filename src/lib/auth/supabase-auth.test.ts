import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  evaluateProfileAccess,
} from "./supabase-login.ts";
import {
  mapUserProfileRow,
  isProfileAccessAllowed,
} from "../supabase/user-profiles-repo.ts";
import { profileToSessionUser } from "./map-session.ts";
import type { UserProfile } from "../supabase/user-profiles-repo.ts";

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    authUserId: "22222222-2222-2222-2222-222222222222",
    email: "olivia@spiora.demo",
    firstName: "Olivia",
    lastName: "Bennett",
    displayName: "Olivia Bennett",
    avatarUrl: null,
    role: "owner",
    status: "active",
    language: "en",
    timezone: "Europe/Zagreb",
    lastLoginAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    archivedAt: null,
    isDemo: true,
    mfaReenrollRequired: false,
    ...overrides,
  };
}

describe("supabase auth profile gating", () => {
  it("maps active owner profile to session with role from profile", () => {
    const profile = makeProfile({ role: "owner" });
    const session = profileToSessionUser(profile);
    assert.ok(session);
    assert.equal(session.role, "owner");
    assert.equal(session.authUserId, profile.authUserId);
    assert.equal(session.name, "Olivia Bennett");
    assert.equal(session.status, "active");
  });

  it("maps manager profile role from user_profiles", () => {
    const profile = makeProfile({
      role: "manager",
      email: "daniel@spiora.demo",
      displayName: "Daniel Cooper",
    });
    const session = profileToSessionUser(profile);
    assert.ok(session);
    assert.equal(session.role, "manager");
  });

  it("rejects suspended profile", () => {
    const profile = makeProfile({ status: "suspended" });
    assert.equal(isProfileAccessAllowed(profile), false);
    assert.deepEqual(evaluateProfileAccess(profile), {
      ok: false,
      code: "suspended",
    });
  });

  it("rejects archived profile", () => {
    const profile = makeProfile({
      status: "archived",
      archivedAt: "2026-01-02T00:00:00.000Z",
    });
    assert.equal(isProfileAccessAllowed(profile), false);
    assert.deepEqual(evaluateProfileAccess(profile), {
      ok: false,
      code: "archived",
    });
  });

  it("missing/invalid role does not become session", () => {
    const row = {
      id: "11111111-1111-1111-1111-111111111111",
      auth_user_id: "22222222-2222-2222-2222-222222222222",
      email: "x@spiora.demo",
      first_name: "X",
      last_name: "Y",
      display_name: "X Y",
      avatar_url: null,
      role: "hacker",
      status: "active",
      language: "en",
      timezone: "UTC",
      last_login_at: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      archived_at: null,
      is_demo: true,
    };
    assert.equal(mapUserProfileRow(row), null);
  });

  it("consultant/viewer profiles are not runtime SessionUser yet", () => {
    const profile = makeProfile({ role: "consultant" });
    assert.equal(profileToSessionUser(profile), null);
  });
});
