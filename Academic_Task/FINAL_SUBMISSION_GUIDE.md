# Final Submission Guide

This file documents the final academic submission requirements and the files included in this repository.

## Required Submission Items

The DBLab assignment requires both of the following:

1. GitHub repository containing:
   - Updated ERD diagram
   - Normalization document with 1NF to 3NF justifications
   - Dataflow description
   - Cleaned or synthetic CSV files
   - DDL scripts (`CREATE TABLE` statements)
   - DML scripts with validation query output
   - Clear commit history with at least one commit per milestone

2. Single PDF upload containing:
   - Group name and member names
   - Updated ERD diagram
   - Normalization walkthrough
   - Dataflow description
   - GitHub repository link

## Files Included in This Academic Package

- `DBLab_ProjectUpdate.pdf` — assignment brief
- `ERD_Documentation.pdf` — completed Module 1 deliverable
- `academic-erd.drawio` — visual ERD diagram for the academic schema
- `academic-erd-simplified.md` — compact ERD table reference
- `NORMALIZATION.md` — Milestone 2 normalization documentation
- `DATAFLOW.md` — Milestone 3 dataflow and preprocessing notes
- `csv/` — synthetic dataset exports for Milestone 3
- `sql/milestone-4-ddl.sql` — DDL definitions for the normalized schema
- `sql/milestone-5-dml.sql` — data loading, update/delete examples, and validation queries
## How to Produce the Final PDF

1. Open the ERD diagram (`academic-erd.drawio`) and export it as a PDF or image.
2. Combine the following documentation into a single PDF:
   - `academic-erd-simplified.md`
   - `NORMALIZATION.md`
   - `DATAFLOW.md`
   - `FINAL_SUBMISSION_GUIDE.md`
3. Add the GitHub repository URL and group member names to the PDF.
4. Name the file using the required format:
   - `GroupName_Version_Control_DBLab.pdf`

## GitHub Repository Notes

- If you want to push to a separate repository, add a remote for `https://github.com/m-saad-1/broady-dblab` and push the academic folder there.
- Maintain separate commits for each milestone:
  - `M2: Applied 2NF and 3NF normalization, updated ERD and schema`
  - `M3: Synthetic data generated; dataflow documented`
  - `M4: DDL scripts added, EER diagram verified`
  - `M5: Data populated validation queries added`

## Notes for the Instructor

This submission uses PostgreSQL and Prisma for the implementation because the existing Broady project is already built with PostgreSQL. The academic work preserves the same relationships and normalization goals described in the MySQL-flavored assignment brief.
