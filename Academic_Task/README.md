# Broady DBLab Academic Task

This folder contains the academic submission work for the Broady DBLab assignment.

The main application in this workspace is a PostgreSQL + Prisma project. The assignment PDF uses MySQL wording, but the academic work here keeps the actual implementation aligned with the existing PostgreSQL schema and relationships.

## What Is In This Folder

- `DBLab_ProjectUpdate.pdf` - assignment brief
- `ERD_Documentation.pdf` - completed Module 1 deliverable
- `academic-task-plan.md` - step-by-step milestone guide
- `NORMALIZATION.md` - Milestone 2 normalization write-up
- `DATAFLOW.md` - Milestone 3 dataset preprocessing and flow
- `csv/` - real dataset extracts for Milestone 3
- `sql/milestone-4-ddl.sql` - PostgreSQL DDL for Milestone 4
- `sql/milestone-5-dml.sql` - data load and validation SQL for Milestone 5
- `FINAL_SUBMISSION_GUIDE.md` - final PDF submission checklist and guidance
- `academic-erd-simplified.md` - compact ERD reference
- `academic-erd.drawio` - visual ERD diagram

## Milestone Flow

1. Milestone 2 - ERD design and normalization
2. Milestone 3 - dataset preprocessing and dataflow
3. Milestone 4 - database setup and DDL
4. Milestone 5 - data population and validation

## Milestone 2 Goal

Milestone 2 started the academic implementation by documenting normalization from 1NF to 3NF and aligning the ERD with the normalized structure.

The priority for this repo has been to preserve the existing business relationships and avoid deleting sensitive data, seed data, or important records while fulfilling the academic requirements.

## Working Notes

- The academic work is kept separate from the production Broady flow.
- It reuses the existing marketplace relationships as the schema reference.
- Normalization choices are clearly documented when a table already satisfies a normal form.
- PostgreSQL terminology is used where it matters, while keeping the assignment language understandable for the instructor.

## Final Status

**All milestones (M2 to M5) are fully completed.**

Please refer to the `FINAL_SUBMISSION_GUIDE.md` to produce the final PDF and package the repository for submission.
