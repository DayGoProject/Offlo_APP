/**
 * 목표 관리 화면의 그림 — 데이터는 props로만 받는다 (mobile.md "웹 미리보기 — 미리보기 화면").
 * `app/(app)/goals.tsx`는 불러오기 · 저장을, `app/preview/goals.tsx`는 샘플 값을 넘긴다. 이 파일은 `api` · `useAuth` · Firebase를 import하지 않는다.
 *
 * 웹 `/goals`와 같은 구성(진행 중 카드 · 완료한 목표 목록 · 새 목표 모달)에 **수정**을 더했다 (서버 PATCH가 이미 제목 · 시간 · 기간을 받는다).
 * 되돌릴 수 없는 일(삭제 · 완료 처리 — 완료하면 서버가 식물 경험치를 준다)은 카드 안에서 한 번 더 묻는다 — 브라우저 · OS 대화상자는 쓰지 않는다.
 */
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import Card from "@/components/app/Card";
import ErrorNotice from "@/components/app/ErrorNotice";
import { SmallCheckIcon } from "@/components/app/Icons";
import PageHeader from "@/components/app/PageHeader";
import Pill from "@/components/app/Pill";
import Screen from "@/components/app/Screen";
import Skeleton from "@/components/app/Skeleton";
import GoalFormModal from "@/components/goals/GoalFormModal";
import {
  GOAL_COMPLETE_EXP,
  defaultGoalForm,
  formFromGoal,
  goalDateKey,
  goalNote,
  goalSpan,
  goalsEyebrow,
  splitGoals,
} from "@/logic/goals";
import type { CreateGoalInput, Goal } from "@/services/api-types";
import { fmt } from "@/shared/format";
import { colors, em, fonts, radius } from "@/theme";

export interface GoalsViewProps {
  /** 기준 시각(ms) — 기간 진행의 "오늘"(KST) */
  now: number;
  goals: Goal[] | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  /** 서버에 보내는 중인 목표 — 그 카드의 버튼이 잠긴다 (두 번 눌러도 한 번만 간다) */
  busyId: string | null;
  /** 완료 · 삭제 실패 한 줄 (한국어) */
  actionError: string | null;
  /** 저장 — 실패하면 폼 안에 띄울 문구, 성공하면 null */
  onCreate: (input: CreateGoalInput) => Promise<string | null>;
  onUpdate: (goal: Goal, input: CreateGoalInput) => Promise<string | null>;
  onComplete: (goal: Goal) => Promise<void>;
  onDelete: (goal: Goal) => Promise<void>;
  /** 미리보기 — 처음부터 추가 폼을 열어 둔다 */
  startOpen?: boolean;
}

type Ask = { id: string; kind: "complete" | "delete" } | null;
type FormState = { mode: "create" } | { mode: "edit"; goal: Goal } | null;

const SECTION_ACTIVE = "진행 중";
const SECTION_DONE = "완료한 목표";

export default function GoalsView({
  now,
  goals,
  loading,
  error,
  onRetry,
  busyId,
  actionError,
  onCreate,
  onUpdate,
  onComplete,
  onDelete,
  startOpen = false,
}: GoalsViewProps) {
  const [form, setForm] = useState<FormState>(startOpen ? { mode: "create" } : null);
  const [formKey, setFormKey] = useState(0);
  const [ask, setAsk] = useState<Ask>(null);
  const [showDone, setShowDone] = useState(true);

  const ready = goals !== null;
  const { active, done } = splitGoals(goals ?? []);

  const open = (next: Exclude<FormState, null>) => {
    setAsk(null);
    setFormKey((k) => k + 1);
    setForm(next);
  };

  return (
    <Screen testID="goals" refreshing={loading && ready} onRefresh={onRetry}>
      <PageHeader
        eyebrow={goalsEyebrow(goals)}
        title="목표 관리"
        actions={
          <>
            {done.length > 0 ? (
              <Pill testID="goals-toggle-done" label={showDone ? "완료 숨기기" : "완료한 목표"} onPress={() => setShowDone((v) => !v)} />
            ) : null}
            <Pill testID="goal-add" variant="primary" label="새 목표 추가" onPress={() => open({ mode: "create" })} />
          </>
        }
      />

      {error ? <ErrorNotice testID="goals-error" message={error} onRetry={onRetry} /> : null}
      {actionError ? <ErrorNotice testID="goals-action-error" message={actionError} /> : null}

      {/* ── 진행 중 ── */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{SECTION_ACTIVE}</Text>
        {!ready ? (
          error ? null : <Skeleton testID="goals-skeleton" height={150} radius={radius.card} />
        ) : active.length === 0 ? (
          <Card testID="goals-empty">
            <View style={styles.emptyText}>
              <Text style={styles.emptyTitle}>진행 중인 목표가 없어요</Text>
              <Text style={styles.emptyBody}>하루 사용 시간 상한을 하나만 정해도 달라집니다. 기간은 일주일이면 충분해요.</Text>
            </View>
            <View style={styles.row}>
              <Pill testID="goal-add-empty" variant="accent" label="목표 추가하기" onPress={() => open({ mode: "create" })} />
            </View>
          </Card>
        ) : (
          active.map((goal) => (
            <ActiveGoal
              key={goal.id}
              goal={goal}
              now={now}
              busy={busyId === goal.id}
              ask={ask?.id === goal.id ? ask.kind : null}
              onAsk={(kind) => setAsk(kind ? { id: goal.id, kind } : null)}
              onEdit={() => open({ mode: "edit", goal })}
              onComplete={async () => {
                await onComplete(goal);
                setAsk(null);
              }}
              onDelete={async () => {
                await onDelete(goal);
                setAsk(null);
              }}
            />
          ))
        )}
      </View>

      {/* ── 완료한 목표 ── */}
      {showDone && done.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{SECTION_DONE}</Text>
          <Card testID="goals-done" style={styles.doneCard}>
            {done.map((goal, i) => (
              <DoneGoal
                key={goal.id}
                goal={goal}
                last={i === done.length - 1}
                busy={busyId === goal.id}
                confirming={ask?.id === goal.id && ask.kind === "delete"}
                onAsk={(on) => setAsk(on ? { id: goal.id, kind: "delete" } : null)}
                onDelete={async () => {
                  await onDelete(goal);
                  setAsk(null);
                }}
              />
            ))}
          </Card>
        </View>
      ) : null}

      {form ? (
        <GoalFormModal
          key={formKey}
          mode={form.mode}
          initial={form.mode === "edit" ? formFromGoal(form.goal) : defaultGoalForm(now)}
          now={now}
          onSubmit={async (input) => {
            const message = form.mode === "edit" ? await onUpdate(form.goal, input) : await onCreate(input);
            if (!message) setForm(null);
            return message;
          }}
          onClose={() => setForm(null)}
        />
      ) : null}
    </Screen>
  );
}

function ActiveGoal({
  goal,
  now,
  busy,
  ask,
  onAsk,
  onEdit,
  onComplete,
  onDelete,
}: {
  goal: Goal;
  now: number;
  busy: boolean;
  ask: "complete" | "delete" | null;
  onAsk: (kind: "complete" | "delete" | null) => void;
  onEdit: () => void;
  onComplete: () => void;
  onDelete: () => void;
}) {
  const span = goalSpan(goal, now);
  const quiet = span.expired || span.startsIn > 0;

  return (
    <View
      testID={`goal-${goal.id}`}
      style={[styles.goal, { borderColor: quiet ? colors.borderCard : colors.accentLine }]}
    >
      <View style={styles.goalHead}>
        <Text testID={`goal-title-${goal.id}`} style={styles.goalTitle}>
          {goal.title}
        </Text>
        <Text style={styles.goalSub}>
          <Text style={styles.num}>{goalDateKey(goal.startDate).replace(/-/g, ".")}</Text>
          {" — "}
          <Text style={styles.num}>{goalDateKey(goal.endDate).replace(/-/g, ".")}</Text>
          {` · 하루 ${fmt(goal.targetMinutes)} 이하`}
        </Text>
      </View>

      <View style={styles.progress}>
        <View style={styles.progressTop}>
          <Text style={styles.progressLabel}>진행률</Text>
          <Text testID={`goal-pct-${goal.id}`} style={styles.pct}>
            {span.pct}%
          </Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${span.pct}%` }]} />
        </View>
        {/* 마감이 지난 · 시작 전인 목표는 강조하지 않는다 — 재촉이 아니라 정리의 대상이다 */}
        <Text testID={`goal-note-${goal.id}`} style={[styles.note, { color: quiet ? colors.textMuted : colors.brand }]}>
          {goalNote(span)}
        </Text>
      </View>

      {ask ? (
        <View testID={`goal-ask-${goal.id}`} style={styles.ask}>
          <Text style={styles.askText}>
            {ask === "complete"
              ? `목표를 완료 처리할까요? 완료하면 식물이 ${GOAL_COMPLETE_EXP}분 자라요. 되돌릴 수 없어요.`
              : "이 목표를 삭제할까요? 되돌릴 수 없어요."}
          </Text>
          <View style={styles.actions}>
            <Pill testID={`goal-ask-cancel-${goal.id}`} label="취소" onPress={() => onAsk(null)} disabled={busy} />
            {ask === "complete" ? (
              <Pill
                testID={`goal-ask-ok-${goal.id}`}
                variant="accent"
                label={busy ? "처리 중…" : "완료 처리"}
                onPress={onComplete}
                disabled={busy}
              />
            ) : (
              <Pill
                testID={`goal-ask-ok-${goal.id}`}
                variant="danger"
                label={busy ? "삭제 중…" : "삭제"}
                onPress={onDelete}
                disabled={busy}
              />
            )}
          </View>
        </View>
      ) : (
        <View style={styles.actions}>
          <Pill testID={`goal-edit-${goal.id}`} label="수정" onPress={onEdit} disabled={busy} />
          <Pill testID={`goal-delete-${goal.id}`} label="삭제" onPress={() => onAsk("delete")} disabled={busy} />
          <Pill testID={`goal-complete-${goal.id}`} variant="accent" label="완료 처리" onPress={() => onAsk("complete")} disabled={busy} />
        </View>
      )}
    </View>
  );
}

function DoneGoal({
  goal,
  last,
  busy,
  confirming,
  onAsk,
  onDelete,
}: {
  goal: Goal;
  last: boolean;
  busy: boolean;
  confirming: boolean;
  onAsk: (on: boolean) => void;
  onDelete: () => void;
}) {
  return (
    <View testID={`goal-done-${goal.id}`} style={[styles.doneRow, !last && styles.divider]}>
      <View style={styles.doneMain}>
        <View style={styles.doneCheck}>
          <SmallCheckIcon color={colors.brand} size={11} />
        </View>
        <View style={styles.doneText}>
          <Text numberOfLines={2} style={styles.doneTitle}>
            {goal.title}
          </Text>
          <Text style={styles.doneSub}>
            <Text style={styles.num}>{goalDateKey(goal.endDate).replace(/-/g, ".")}</Text>
            {" 까지 · "}
            <Text style={{ color: colors.brand }}>{`+${GOAL_COMPLETE_EXP}분`}</Text>
          </Text>
        </View>
        {confirming ? null : (
          <Pill testID={`goal-done-delete-${goal.id}`} label="삭제" onPress={() => onAsk(true)} disabled={busy} />
        )}
      </View>
      {confirming ? (
        <View style={styles.doneAsk}>
          <Text style={styles.askText}>이 기록을 삭제할까요?</Text>
          <View style={styles.actions}>
            <Pill testID={`goal-ask-cancel-${goal.id}`} label="취소" onPress={() => onAsk(false)} disabled={busy} />
            <Pill testID={`goal-ask-ok-${goal.id}`} variant="danger" label={busy ? "삭제 중…" : "삭제"} onPress={onDelete} disabled={busy} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 14,
  },
  sectionLabel: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: em(11, 0.14),
    color: colors.textMuted,
  },
  row: {
    flexDirection: "row",
  },
  emptyText: {
    gap: 6,
  },
  emptyTitle: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  emptyBody: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textMuted,
  },
  goal: {
    gap: 18,
    paddingHorizontal: 20,
    paddingVertical: 22,
    borderRadius: radius.card,
    borderWidth: 1,
    backgroundColor: colors.bgCard,
  },
  goalHead: {
    gap: 8,
  },
  goalTitle: {
    fontFamily: fonts.semibold,
    fontSize: 17,
    lineHeight: 24,
    letterSpacing: em(17, -0.015),
    color: colors.textPrimary,
  },
  goalSub: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
  },
  num: {
    fontFamily: fonts.num,
    fontVariant: ["tabular-nums"],
  },
  progress: {
    gap: 10,
  },
  progressTop: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  progressLabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
  pct: {
    fontFamily: fonts.num,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: em(22, -0.03),
    fontVariant: ["tabular-nums"],
    color: colors.textPrimary,
  },
  track: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.scoreTrack,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
  },
  note: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 10,
  },
  ask: {
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.borderCard,
    backgroundColor: colors.bgSubtle,
  },
  askText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textPrimarySoft,
  },
  doneCard: {
    paddingVertical: 4,
    paddingHorizontal: 0,
    gap: 0,
    overflow: "hidden",
  },
  doneRow: {
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderCard,
  },
  doneMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  doneCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentSoft,
  },
  doneText: {
    flex: 1,
    gap: 2,
  },
  doneTitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  doneSub: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
  doneAsk: {
    gap: 12,
  },
});
