package app.newaveflow.mobile;
import android.app.job.*;
import android.content.*;
import java.util.concurrent.*;
public class WidgetRefreshJob extends JobService {
    private Future<?> task;
    static void schedule(Context context){
        JobScheduler scheduler=(JobScheduler)context.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        scheduler.schedule(new JobInfo.Builder(38417,new ComponentName(context,WidgetRefreshJob.class))
            .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setOverrideDeadline(1000).build());
    }
    @Override public boolean onStartJob(JobParameters params){
        var executor=Executors.newSingleThreadExecutor();
        task=executor.submit(()->{try{WidgetNetwork.fetch(this,null);}finally{jobFinished(params,false);executor.shutdown();}});return true;
    }
    @Override public boolean onStopJob(JobParameters params){if(task!=null)task.cancel(true);return false;}
}
