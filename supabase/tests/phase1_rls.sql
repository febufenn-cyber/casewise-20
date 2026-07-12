-- Run with pgTAP in a disposable Supabase project.
begin;
select plan(8);
select has_table('public','matters','matters exists');
select has_table('public','uploaded_files','uploaded_files exists');
select has_table('public','source_spans','source_spans exists');
select has_table('public','deletion_requests','deletion_requests exists');
select policies_are('public','matters',array['matters_select'],'matters has explicit policy');
select policies_are('public','uploaded_files',array['uploaded_files_select'],'uploaded files have explicit policy');
select policies_are('public','source_spans',array['source_spans_select'],'source spans have explicit policy');
select policies_are('public','deletion_requests',array['deletion_requests_select'],'deletion requests are manager-only');
select * from finish();
rollback;
