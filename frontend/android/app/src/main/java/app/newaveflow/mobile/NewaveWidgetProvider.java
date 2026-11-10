package app.newaveflow.mobile;
import android.app.PendingIntent;
import android.appwidget.*;
import android.content.*;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;
import org.json.*;
import java.text.SimpleDateFormat;
import java.util.*;

public class NewaveWidgetProvider extends AppWidgetProvider {
    @Override public void onUpdate(Context context,AppWidgetManager manager,int[] ids){renderAll(context);WidgetRefreshJob.schedule(context);}
    @Override public void onAppWidgetOptionsChanged(Context c,AppWidgetManager m,int id,Bundle b){renderAll(c);}
    static PendingIntent open(Context context,String path,int id){
        String scheme=context.getPackageName().endsWith(".verification")?"newaveflowverification":"newaveflow";
        Intent intent=new Intent(Intent.ACTION_VIEW,new Uri.Builder().scheme(scheme).authority("widget").path("/open").appendQueryParameter("path",path).build(),context,MainActivity.class);
        return PendingIntent.getActivity(context,id,intent,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    }
    static void renderAll(Context context){
        AppWidgetManager manager=AppWidgetManager.getInstance(context);int[] ids=manager.getAppWidgetIds(new ComponentName(context,NewaveWidgetProvider.class));
        for(int id:ids)try{render(context,manager,id);}catch(Exception ignored){}
    }
    private static void render(Context context,AppWidgetManager manager,int id)throws Exception{
        JSONObject session=WidgetStore.read(context);
        int height=manager.getAppWidgetOptions(id).getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT,280);
        manager.updateAppWidget(id,buildViews(context,id,session,height,new Date()));
    }
    static RemoteViews buildViews(Context context,int id,JSONObject session,int height,Date now)throws Exception{
        RemoteViews view=new RemoteViews(context.getPackageName(),R.layout.newave_widget);
        view.setOnClickPendingIntent(R.id.widget_title,open(context,"/profile/widgets",1));
        JSONObject snapshot=session==null?null:session.optJSONObject("snapshot");
        SimpleDateFormat format=new SimpleDateFormat("yyyy-MM-dd",Locale.ROOT);format.setTimeZone(TimeZone.getTimeZone("Asia/Seoul"));
        String today=format.format(now);boolean fresh=snapshot!=null&&today.equals(snapshot.optString("date"));
        String message=session==null?"앱에서 로그인해주세요":!fresh?"앱을 열어 오늘의 기록을 확인해주세요":session.optString("error","");
        view.setTextViewText(R.id.widget_date,today.substring(5).replace('-','.'));
        view.setTextViewText(R.id.widget_message,message);
        view.setViewVisibility(R.id.widget_message,message.isEmpty()?View.GONE:View.VISIBLE);
        view.removeAllViews(R.id.widget_checks);view.removeAllViews(R.id.widget_tasks);
        view.setTextViewText(R.id.widget_event,"등록된 일정이 없어요");
        view.setOnClickPendingIntent(R.id.widget_event,open(context,"/calendar",2));
        view.setOnClickPendingIntent(R.id.widget_more,open(context,"/tts",3));
        view.setTextViewText(R.id.widget_progress,"이번 주 체크");
        if(fresh){
            JSONArray schedules=snapshot.optJSONArray("events"),checks=snapshot.optJSONArray("checks"),tasks=snapshot.optJSONArray("tasks");
            if(schedules!=null&&schedules.length()>0){JSONObject e=schedules.getJSONObject(0);
                view.setTextViewText(R.id.widget_event,e.optString("date").substring(5).replace('-','.')+" "+e.optString("time")+"\n"+e.optString("title"));
                view.setOnClickPendingIntent(R.id.widget_event,open(context,e.optString("path","/calendar"),2));}
            int rows=Math.max(1,(height-182)/32),limit=Math.max(1,Math.min(checks==null?1:checks.length(),Math.min(4,rows-1)));
            int taskLimit=Math.max(0,rows-limit);
            if(checks!=null)for(int i=0;i<Math.min(checks.length(),limit);i++){
                JSONObject check=checks.getJSONObject(i);RemoteViews row=new RemoteViews(context.getPackageName(),R.layout.newave_widget_row);
                boolean checked=check.optBoolean("checked");row.setTextViewText(R.id.widget_row,(checked?"✓  ":"□  ")+check.optString("title"));
                row.setTextColor(R.id.widget_row,checked?0xff206646:0xff173263);
                if(message.isEmpty()){
                    // Never mutate an old button's meaning when the date/account/check state changes.
                    Uri identity=new Uri.Builder().scheme("newavewidget").authority("check").appendPath(String.valueOf(id))
                        .appendPath(session.optString("scope")).appendPath(today).appendPath(String.valueOf(check.getLong("id"))).appendPath(String.valueOf(!checked)).build();
                    Intent action=new Intent(context,WidgetActionReceiver.class).setData(identity)
                        .putExtra("id",check.getLong("id")).putExtra("date",today).putExtra("scope",session.optString("scope"))
                        .putExtra("checked",!checked).putExtra("expected",checked);
                    row.setOnClickPendingIntent(R.id.widget_row,PendingIntent.getBroadcast(context,0,action,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE));
                }else row.setOnClickPendingIntent(R.id.widget_row,open(context,"/tts",3));
                view.addView(R.id.widget_checks,row);
            }
            if(checks==null||checks.length()==0){RemoteViews row=new RemoteViews(context.getPackageName(),R.layout.newave_widget_row);row.setTextViewText(R.id.widget_row,"오늘 체크할 항목이 없어요");view.addView(R.id.widget_checks,row);}
            int total=0,done=0,shown=0;
            if(tasks!=null)for(int i=0;i<tasks.length();i++){
                JSONObject task=tasks.getJSONObject(i);if("none".equals(task.optString("state")))continue;total++;
                boolean complete="done".equals(task.optString("state"));if(complete)done++;
                if(shown++<taskLimit){RemoteViews row=new RemoteViews(context.getPackageName(),R.layout.newave_widget_row);
                    row.setTextViewText(R.id.widget_row,task.optString("title")+"  "+(complete?"완료":"미완료")+"  ›");
                    row.setOnClickPendingIntent(R.id.widget_row,open(context,task.optString("path"),30+i));view.addView(R.id.widget_tasks,row);}
            }
            view.setTextViewText(R.id.widget_progress,"이번 주  "+done+" / "+total);
        }
        return view;
    }
}
