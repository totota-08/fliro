import { collection, getCountFromServer, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { TaskDoc } from "@/services/taskService";

export async function fetchScaleStats() {
  const [userSnap, projectSnap] = await Promise.all([
    getCountFromServer(collection(db, "profiles")),
    getCountFromServer(collection(db, "projects")),
  ]);

  return {
    users: userSnap.data().count,
    projects: projectSnap.data().count,
  };
}

export interface MemberWeeklyScore {
  memberId: string;
  memberName: string;
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
}

export interface WeeklyScoreResult {
  weekStart: Date;
  weekEnd: Date;
  memberScores: MemberWeeklyScore[];
}

/**
 * 指定されたプロジェクトの週次タスク完了率を計算する
 * @param projectId - プロジェクトID
 * @param weekOffset - 何週前のデータを取得するか（0=今週、1=先週...）
 */
export async function computeWeeklyScores(
  projectId: string,
  weekOffset: number = 0,
): Promise<WeeklyScoreResult> {
  // 週の開始（月曜日）と終了（日曜日）を計算
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - diff - weekOffset * 7);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  // タスクを取得
  const tasksSnap = await getDocs(
    collection(db, "projects", projectId, "tasks"),
  );
  const tasks: TaskDoc[] = tasksSnap.docs.map((docSnap) => ({
    id: docSnap.id,
    projectId,
    ...(docSnap.data() as Omit<TaskDoc, "id" | "projectId">),
  }));

  // メンバーを取得
  const membersSnap = await getDocs(
    collection(db, "projects", projectId, "members"),
  );
  const membersMap = new Map<string, string>();
  membersSnap.docs.forEach((docSnap) => {
    const data = docSnap.data();
    const displayName =
      data.nickname ||
      data.fullName ||
      data.displayName ||
      `メンバー ${docSnap.id.slice(-4)}`;
    membersMap.set(docSnap.id, displayName);
  });

  // 週内に作成されたタスクまたは期限があるタスクをフィルタリング
  const weekStartTimestamp = weekStart.getTime() / 1000;
  const weekEndTimestamp = weekEnd.getTime() / 1000;

  const relevantTasks = tasks.filter((task) => {
    // 担当者がいないタスクはスキップ
    if (!task.assigneeId) return false;

    // 期限がある場合、週内に期限があるかチェック
    if (task.dueDate && "seconds" in task.dueDate) {
      const dueTimestamp = task.dueDate.seconds;
      if (
        dueTimestamp >= weekStartTimestamp &&
        dueTimestamp <= weekEndTimestamp
      ) {
        return true;
      }
    }

    // タスクの作成日が週内かチェック
    if (task.createdAt && "seconds" in task.createdAt) {
      const createdTimestamp = task.createdAt.seconds;
      if (
        createdTimestamp >= weekStartTimestamp &&
        createdTimestamp <= weekEndTimestamp
      ) {
        return true;
      }
    }

    return false;
  });

  // メンバーごとにスコアを集計
  const scoreMap = new Map<
    string,
    { total: number; completed: number; name: string }
  >();

  // 全メンバーを初期化（タスクがないメンバーも表示）
  membersMap.forEach((name, memberId) => {
    scoreMap.set(memberId, { total: 0, completed: 0, name });
  });

  relevantTasks.forEach((task) => {
    const memberId = task.assigneeId!;
    const existing = scoreMap.get(memberId) || {
      total: 0,
      completed: 0,
      name: membersMap.get(memberId) || `メンバー ${memberId.slice(-4)}`,
    };
    existing.total += 1;
    if (task.status === "done") {
      existing.completed += 1;
    }
    scoreMap.set(memberId, existing);
  });

  // 結果を配列に変換
  const memberScores: MemberWeeklyScore[] = [];
  scoreMap.forEach((score, memberId) => {
    memberScores.push({
      memberId,
      memberName: score.name,
      totalTasks: score.total,
      completedTasks: score.completed,
      completionRate:
        score.total > 0 ? (score.completed / score.total) * 100 : 0,
    });
  });

  // 完了率でソート（降順）
  memberScores.sort((a, b) => b.completionRate - a.completionRate);

  return {
    weekStart,
    weekEnd,
    memberScores,
  };
}
