# Broady DBLab Academic Task

This folder contains the academic submission work for the Broady DBLab assignment.

The main application in this workspace is a PostgreSQL + Prisma project. The assignment PDF uses MySQL wording, but the academic work here keeps the actual implementation aligned with the existing PostgreSQL schema and relationships.

## What Is In This Folder

- `DBLab_ProjectUpdate.pdf` - assignment brief
- `ERD_Documentation.pdf` - completed Module 1 deliverable
- `academic-task-plan.md` - step-by-step milestone guide
- `NORMALIZATION.md` - Milestone 2 normalization write-up
- `DATAFLOW.md` - Milestone 3 dataset preprocessing and flow
- `csv/` - synthetic CSV staging notes for Milestone 3
- `generate_academic_csv.py` - synthetic CSV dataset generator
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

Milestone 2 starts the academic implementation by documenting normalization from 1NF to 3NF and aligning the ERD with the normalized structure.

The priority for this repo is to preserve the existing business relationships and avoid deleting sensitive data, seed data, or important records.

## Working Notes

- Keep the academic work separate from the production Broady flow.
- Reuse the existing marketplace relationships as the schema reference.
- Document any normalization choice clearly when a table already satisfies a normal form.
- Use PostgreSQL terminology in the final write-up where it matters, while keeping the assignment language understandable for the instructor.

## Recommended Next Steps

1. Review `NORMALIZATION.md` and update it as the schema is finalized.
2. Export or update the ERD if normalization changes any relationships.
3. Review `DATAFLOW.md` and the `csv/` staging notes for Milestone 3.
4. Review the SQL scripts for Milestones 4 and 5 before packaging the final submission.
