import { describe, expect, it } from "vitest";
import { coinsFor, ordinal, rankBoard, rankOf } from "../ranking";
import type { DayCell, Progress } from "../../types";

const cell = (done: number, total: number): DayCell =>
  ({ day: "2026-01-01", index: 1, status: "done", done, total }) as DayCell;

/** Only the fields ranking actually reads; the rest of Progress is noise here. */
const member = (
  user_id: number,
  xp: number,
  streak: number,
  calendar: DayCell[] = []
): Progress => ({ user_id, name: `u${user_id}`, xp, streak, calendar }) as unknown as Progress;

describe("coinsFor", () => {
  it("counts one coin per completed task", () => {
    expect(coinsFor({ calendar: [cell(3, 7), cell(2, 7)] })).toBe(5);
  });

  it("adds the +5 bonus (4 on top of the per-task coin) for a cleared day", () => {
    // 7 tasks done = 7 coins, plus 4 because the day was fully cleared.
    expect(coinsFor({ calendar: [cell(7, 7)] })).toBe(11);
  });

  it("gives no bonus for a day with no tasks, and never counts an empty day", () => {
    expect(coinsFor({ calendar: [cell(0, 0), cell(0, 7)] })).toBe(0);
  });
});

describe("rankBoard", () => {
  it("ranks by xp first, highest first", () => {
    const board = [member(1, 100, 0), member(2, 900, 0), member(3, 400, 0)];
    expect(rankBoard(board).map((e) => e.p.user_id)).toEqual([2, 3, 1]);
    expect(rankBoard(board).map((e) => e.rank)).toEqual([1, 2, 3]);
  });

  it("breaks an xp tie on coins, then on streak", () => {
    const rich = member(1, 500, 0, [cell(7, 7)]); // 11 coins
    const poor = member(2, 500, 0, [cell(1, 7)]); // 1 coin
    expect(rankBoard([poor, rich]).map((e) => e.p.user_id)).toEqual([1, 2]);

    const streaky = member(3, 500, 9, [cell(1, 7)]);
    const flat = member(4, 500, 0, [cell(1, 7)]);
    expect(rankBoard([flat, streaky]).map((e) => e.p.user_id)).toEqual([3, 4]);
  });

  it("gives genuinely level members the same rank, and skips the one after", () => {
    // Competition ranking: 1, 2, 2, 4 -- calling one of two identical members
    // #3 would invent a gap the numbers do not support.
    const board = [member(1, 900, 2), member(2, 500, 1), member(3, 500, 1), member(4, 100, 0)];
    expect(rankBoard(board).map((e) => e.rank)).toEqual([1, 2, 2, 4]);
  });

  it("orders tied members deterministically, so the list cannot jump between renders", () => {
    const a = [member(7, 500, 1), member(3, 500, 1)];
    const b = [member(3, 500, 1), member(7, 500, 1)];
    expect(rankBoard(a).map((e) => e.p.user_id)).toEqual(rankBoard(b).map((e) => e.p.user_id));
  });

  it("does not mutate the board it was handed", () => {
    const board = [member(1, 100, 0), member(2, 900, 0)];
    rankBoard(board);
    expect(board.map((p) => p.user_id)).toEqual([1, 2]);
  });

  it("handles an empty board", () => {
    expect(rankBoard([])).toEqual([]);
  });
});

describe("rankOf", () => {
  it("reports position and field size", () => {
    const board = [member(1, 100, 0), member(2, 900, 0), member(3, 400, 0)];
    expect(rankOf(board, 1)).toEqual({ rank: 3, total: 3 });
    expect(rankOf(board, 2)).toEqual({ rank: 1, total: 3 });
  });

  it("is null for someone not on the board, rather than a meaningless #0", () => {
    expect(rankOf([member(1, 100, 0)], 99)).toBeNull();
    expect(rankOf([], 1)).toBeNull();
  });
});

describe("ordinal", () => {
  it("suffixes normally", () => {
    expect([1, 2, 3, 4, 11].map(ordinal)).toEqual(["1st", "2nd", "3rd", "4th", "11th"]);
  });

  it("treats 11/12/13 as 'th' but 21/22/23 as st/nd/rd", () => {
    expect([12, 13, 21, 22, 23, 111].map(ordinal)).toEqual([
      "12th",
      "13th",
      "21st",
      "22nd",
      "23rd",
      "111th",
    ]);
  });
});
