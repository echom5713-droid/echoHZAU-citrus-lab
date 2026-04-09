import { ExperimentRecord } from '@/lib/types'

export const mockRecords: ExperimentRecord[] = [
  { id: '1', created_at: '2026-04-09T10:00:00Z', name: '张三', student_id: '2026001', group_no: 'A1', experiment_date: '2026-04-09', salt_concentration: 0, peel_mass: 50, oil_mass: 0.62, yield_percent: 1.24, replicate_no: 1, note: '纯水对照' },
  { id: '2', created_at: '2026-04-09T10:02:00Z', name: '李四', student_id: '2026002', group_no: 'A1', experiment_date: '2026-04-09', salt_concentration: 0, peel_mass: 50, oil_mass: 0.58, yield_percent: 1.16, replicate_no: 2, note: '纯水对照' },
  { id: '3', created_at: '2026-04-09T10:05:00Z', name: '王五', student_id: '2026003', group_no: 'A2', experiment_date: '2026-04-09', salt_concentration: 0, peel_mass: 50, oil_mass: 0.61, yield_percent: 1.22, replicate_no: 1, note: '' },
  { id: '4', created_at: '2026-04-09T10:10:00Z', name: '赵六', student_id: '2026004', group_no: 'A2', experiment_date: '2026-04-09', salt_concentration: 1, peel_mass: 50, oil_mass: 0.69, yield_percent: 1.38, replicate_no: 1, note: '' },
  { id: '5', created_at: '2026-04-09T10:12:00Z', name: '钱七', student_id: '2026005', group_no: 'A2', experiment_date: '2026-04-09', salt_concentration: 1, peel_mass: 50, oil_mass: 0.71, yield_percent: 1.42, replicate_no: 2, note: '' },
  { id: '6', created_at: '2026-04-09T10:14:00Z', name: '孙八', student_id: '2026006', group_no: 'A3', experiment_date: '2026-04-09', salt_concentration: 1, peel_mass: 50, oil_mass: 0.7, yield_percent: 1.4, replicate_no: 1, note: '' },
  { id: '7', created_at: '2026-04-09T10:16:00Z', name: '周九', student_id: '2026007', group_no: 'A3', experiment_date: '2026-04-09', salt_concentration: 3, peel_mass: 50, oil_mass: 0.82, yield_percent: 1.64, replicate_no: 1, note: '当前最优' },
  { id: '8', created_at: '2026-04-09T10:18:00Z', name: '吴十', student_id: '2026008', group_no: 'A3', experiment_date: '2026-04-09', salt_concentration: 3, peel_mass: 50, oil_mass: 0.79, yield_percent: 1.58, replicate_no: 2, note: '' },
  { id: '9', created_at: '2026-04-09T10:20:00Z', name: '郑一', student_id: '2026009', group_no: 'A4', experiment_date: '2026-04-09', salt_concentration: 3, peel_mass: 50, oil_mass: 0.81, yield_percent: 1.62, replicate_no: 1, note: '' },
  { id: '10', created_at: '2026-04-09T10:22:00Z', name: '王二', student_id: '2026010', group_no: 'A4', experiment_date: '2026-04-09', salt_concentration: 4, peel_mass: 50, oil_mass: 0.74, yield_percent: 1.48, replicate_no: 1, note: '' },
  { id: '11', created_at: '2026-04-09T10:24:00Z', name: '陈三', student_id: '2026011', group_no: 'A4', experiment_date: '2026-04-09', salt_concentration: 4, peel_mass: 50, oil_mass: 0.76, yield_percent: 1.52, replicate_no: 2, note: '' },
  { id: '12', created_at: '2026-04-09T10:26:00Z', name: '刘四', student_id: '2026012', group_no: 'A5', experiment_date: '2026-04-09', salt_concentration: 4, peel_mass: 50, oil_mass: 0.73, yield_percent: 1.46, replicate_no: 1, note: '' }
]
