import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { LineLink } from "./model";
import {
  areRemindersOn,
  findUserIdByLineUserId,
  getLineStatus,
  listReminderRecipients,
  recordLineAccount,
  REMINDER_CAP,
  removeLineLink,
  setFriendByLineUserId,
  setReminders,
  type FriendshipProbe,
} from "./service";

let server: MongoMemoryServer;

const isFriend: FriendshipProbe = async () => true;
const isNotFriend: FriendshipProbe = async () => false;
const lineIsDown: FriendshipProbe = async () => undefined;

function link(name: string, probe: FriendshipProbe = isFriend) {
  return recordLineAccount(
    { userId: `user-${name}`, lineUserId: `U-${name}`, accessToken: `token-${name}` },
    probe,
  );
}

async function linkMany(count: number) {
  for (let i = 1; i <= count; i++) await link(String(i));
}

beforeAll(async () => {
  server = await MongoMemoryServer.create();
  process.env.MONGODB_URI = server.getUri("line-test");
});

afterAll(async () => {
  await mongoose.disconnect();
  await server.stop();
});

beforeEach(async () => {
  await getLineStatus("nobody");
  await LineLink.deleteMany({});
});

describe("a user without LINE", () => {
  it("is reported as not linked, with reminders off", async () => {
    expect(await getLineStatus("user-ada")).toEqual({ linked: false });
    expect(await areRemindersOn("user-ada")).toBe(false);
  });

  it("cannot switch reminders on", async () => {
    expect(await setReminders("user-ada", true)).toEqual({ kind: "not-linked" });
  });
});

describe("linking a LINE account", () => {
  it("records the LINE user id and whether the user is already a friend of the bot", async () => {
    await link("ada", isFriend);

    expect(await getLineStatus("user-ada")).toEqual({
      linked: true,
      friend: true,
      switchedOn: true,
      remindersOn: true,
    });
    expect(await findUserIdByLineUserId("U-ada")).toBe("user-ada");
  });

  it("leaves reminders off until the user is a friend of the bot", async () => {
    await link("ada", isNotFriend);

    expect(await getLineStatus("user-ada")).toEqual({
      linked: true,
      friend: false,
      switchedOn: true,
      remindersOn: false,
    });
    expect(await areRemindersOn("user-ada")).toBe(false);
  });

  it("treats the user as not yet a friend when LINE cannot be asked", async () => {
    await link("ada", lineIsDown);

    expect(await getLineStatus("user-ada")).toMatchObject({ linked: true, friend: false });
  });

  it("links without asking LINE when there is no access token", async () => {
    await recordLineAccount({ userId: "user-ada", lineUserId: "U-ada" }, async () => {
      throw new Error("The probe must not be called");
    });

    expect(await getLineStatus("user-ada")).toMatchObject({ linked: true, friend: false });
  });

  it("refreshes the friend flag when the same account is seen again", async () => {
    await link("ada", isNotFriend);

    await link("ada", isFriend);

    expect(await areRemindersOn("user-ada")).toBe(true);
  });

  it("keeps what it knew when LINE cannot be asked on a later sign-in", async () => {
    await link("ada", isFriend);

    await link("ada", lineIsDown);

    expect(await getLineStatus("user-ada")).toMatchObject({ friend: true });
  });

  it("does not switch reminders back on when the user had switched them off", async () => {
    await link("ada");
    await setReminders("user-ada", false);

    await link("ada");

    expect(await getLineStatus("user-ada")).toMatchObject({ switchedOn: false });
  });

  it("forgets the friend flag when the user links a different LINE account", async () => {
    await link("ada", isFriend);

    await recordLineAccount({ userId: "user-ada", lineUserId: "U-other" }, lineIsDown);

    expect(await getLineStatus("user-ada")).toMatchObject({ linked: true, friend: false });
    expect(await findUserIdByLineUserId("U-ada")).toBeNull();
    expect(await findUserIdByLineUserId("U-other")).toBe("user-ada");
  });

  it("moves a LINE account to the user who links it now", async () => {
    await link("ada");

    await recordLineAccount({ userId: "user-bob", lineUserId: "U-ada" }, isFriend);

    expect(await getLineStatus("user-ada")).toEqual({ linked: false });
    expect(await findUserIdByLineUserId("U-ada")).toBe("user-bob");
  });
});

describe("unlinking", () => {
  it("removes the link and turns reminders off", async () => {
    await link("ada");

    await removeLineLink("user-ada");

    expect(await getLineStatus("user-ada")).toEqual({ linked: false });
    expect(await areRemindersOn("user-ada")).toBe(false);
    expect(await findUserIdByLineUserId("U-ada")).toBeNull();
  });
});

describe("friendship events", () => {
  const at = (seconds: number) => new Date(Date.UTC(2026, 9, 3, 9, 0, seconds));

  it("sets the friend flag on follow and clears it on unfollow", async () => {
    await link("ada", isNotFriend);

    expect(await setFriendByLineUserId("U-ada", true, at(1))).toBe(true);
    expect(await areRemindersOn("user-ada")).toBe(true);

    expect(await setFriendByLineUserId("U-ada", false, at(2))).toBe(true);
    expect(await areRemindersOn("user-ada")).toBe(false);
    expect(await getLineStatus("user-ada")).toMatchObject({ friend: false, switchedOn: true });
  });

  it("ignores a LINE user nobody has linked", async () => {
    expect(await setFriendByLineUserId("U-stranger", true, at(1))).toBe(false);
    expect(await LineLink.countDocuments()).toBe(0);
  });

  it("ignores an event older than the last one applied", async () => {
    await link("ada", isNotFriend);
    await setFriendByLineUserId("U-ada", false, at(5));

    expect(await setFriendByLineUserId("U-ada", true, at(3))).toBe(false);

    expect(await getLineStatus("user-ada")).toMatchObject({ friend: false });
  });
});

describe("the reminder switch", () => {
  it("turns reminders off and on again", async () => {
    await link("ada");

    expect(await setReminders("user-ada", false)).toEqual({ kind: "ok" });
    expect(await areRemindersOn("user-ada")).toBe(false);

    expect(await setReminders("user-ada", true)).toEqual({ kind: "ok" });
    expect(await areRemindersOn("user-ada")).toBe(true);
  });

  it("answers ok when the switch is already where it was asked to be", async () => {
    await link("ada");

    expect(await setReminders("user-ada", true)).toEqual({ kind: "ok" });
    expect(await setReminders("user-ada", false)).toEqual({ kind: "ok" });
    expect(await setReminders("user-ada", false)).toEqual({ kind: "ok" });
  });
});

describe("the cap on users with reminders on", () => {
  it("is ten", () => {
    expect(REMINDER_CAP).toBe(10);
  });

  it("links the eleventh user with reminders off and refuses to switch them on", async () => {
    await linkMany(REMINDER_CAP);

    await link("eleventh");

    expect(await getLineStatus("user-eleventh")).toEqual({
      linked: true,
      friend: true,
      switchedOn: false,
      remindersOn: false,
    });
    expect(await setReminders("user-eleventh", true)).toEqual({ kind: "full" });
    expect(await areRemindersOn("user-eleventh")).toBe(false);
  });

  it("counts a user who switched reminders on but is not a friend of the bot", async () => {
    await linkMany(REMINDER_CAP - 1);
    await link("not-a-friend", isNotFriend);

    await link("eleventh");

    expect(await setReminders("user-eleventh", true)).toEqual({ kind: "full" });
  });

  it.each([
    ["switches reminders off", () => setReminders("user-3", false)],
    ["unlinks LINE", () => removeLineLink("user-3")],
  ])("lets the eleventh user in once another user %s", async (_case, leave) => {
    await linkMany(REMINDER_CAP);
    await link("eleventh");

    await leave();

    expect(await setReminders("user-eleventh", true)).toEqual({ kind: "ok" });
    expect(await areRemindersOn("user-eleventh")).toBe(true);
  });

  it("never lets more than ten in when many users switch on at the same moment", async () => {
    const names = Array.from({ length: 25 }, (_, i) => String(i + 1));
    await linkMany(names.length);
    await Promise.all(names.map((name) => setReminders(`user-${name}`, false)));

    const outcomes = await Promise.all(names.map((name) => setReminders(`user-${name}`, true)));

    expect(outcomes.filter((outcome) => outcome.kind === "ok")).toHaveLength(REMINDER_CAP);
    expect(outcomes.filter((outcome) => outcome.kind === "full")).toHaveLength(
      names.length - REMINDER_CAP,
    );
    expect(await listReminderRecipients()).toHaveLength(REMINDER_CAP);
  });

  it("never lets more than ten in when many users link at the same moment", async () => {
    const names = Array.from({ length: 25 }, (_, i) => String(i + 1));

    await Promise.all(names.map((name) => link(name)));

    expect(await listReminderRecipients()).toHaveLength(REMINDER_CAP);
    expect(await LineLink.countDocuments()).toBe(names.length);
  });
});

describe("listReminderRecipients", () => {
  it("lists the users with reminders on, with their LINE user ids", async () => {
    await link("ada");
    await link("bob");
    await link("not-a-friend", isNotFriend);
    await link("switched-off");
    await setReminders("user-switched-off", false);

    const recipients = await listReminderRecipients();

    expect(recipients.sort((a, b) => a.userId.localeCompare(b.userId))).toEqual([
      { userId: "user-ada", lineUserId: "U-ada" },
      { userId: "user-bob", lineUserId: "U-bob" },
    ]);
  });

  it("is empty when nobody has linked LINE", async () => {
    expect(await listReminderRecipients()).toEqual([]);
  });
});
