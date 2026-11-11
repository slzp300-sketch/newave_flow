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
    static final String DAILY="daily", WEEKLY="weekly", COMBINED="combined", CALENDAR="calendar";
    static Class<?> provider(String type) {
        if(DAILY.equals(type))return DailyWidgetProvider.class;
        if(WEEKLY.equals(type))return WeeklyWidgetProvider.class;
        if(CALENDAR.equals(type))return CalendarWidgetProvider.class;
        return NewaveWidgetProvider.class; // Installed widgets keep their component.
    }
    static String typeFor(ComponentName component) {
        if(component!=null)for(String type:new String[]{DAILY,WEEKLY,CALENDAR})
            if(provider(type).getName().equals(component.getClassName()))return type;
        return COMBINED;
    }
    @Override public void onUpdate(Context context,AppWidgetManager manager,int[] ids){renderAll(context);WidgetRefreshJob.schedule(context);}
    @Override public void onAppWidgetOptionsChanged(Context c,AppWidgetManager m,int id,Bundle b){renderAll(c);}
    static PendingIntent open(Context context,String path,int id){
        String scheme=context.getPackageName().endsWith(".verification")?"newaveflowverification":"newaveflow";
        Intent intent=new Intent(Intent.ACTION_VIEW,new Uri.Builder().scheme(scheme).authority("widget").path("/open").appendQueryParameter("path",path).build(),context,MainActivity.class);
        return PendingIntent.getActivity(context,id,intent,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    }
    static void renderAll(Context context){
        AppWidgetManager manager=AppWidgetManager.getInstance(context);
        for(String type:new String[]{DAILY,WEEKLY,COMBINED,CALENDAR})
            for(int id:manager.getAppWidgetIds(new ComponentName(context,provider(type))))try{
                JSONObject session=WidgetStore.read(context);
                int height=manager.getAppWidgetOptions(id).getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT,CALENDAR.equals(type)?360:200);
                manager.updateAppWidget(id,buildViews(context,id,session,height,new Date(),type));
            }catch(Exception ignored){}
    }
    static RemoteViews buildViews(Context context,int id,JSONObject session,int height,Date now)throws Exception{
        return buildViews(context,id,session,height,now,COMBINED);
    }
    static RemoteViews buildViews(Context context,int id,JSONObject session,int height,Date now,String type)throws Exception{
        RemoteViews view=new RemoteViews(context.getPackageName(),R.layout.newave_widget);
        if(DAILY.equals(type))view.setInt(R.id.widget_root,"setBackgroundResource",R.drawable.widget_daily_background);
        view.setOnClickPendingIntent(R.id.widget_root,open(context,CALENDAR.equals(type)?"/calendar":DAILY.equals(type)?"/tts":"/profile/widgets",id));
        SimpleDateFormat format=new SimpleDateFormat("yyyy-MM-dd",Locale.ROOT);format.setTimeZone(TimeZone.getTimeZone("Asia/Seoul"));
        String today=format.format(now);
        JSONObject snapshot=session==null?null:session.optJSONObject("snapshot");
        boolean fresh=snapshot!=null&&today.equals(snapshot.optString("date"));
        String message=session==null?"앱에서 위젯을 연결해주세요":!fresh?"앱을 열어 오늘의 기록을 확인해주세요":session.optString("error","");
        view.setTextViewText(R.id.widget_date,today.substring(5).replace('-','.'));
        for(int section:new int[]{R.id.widget_event,R.id.widget_subtitle,R.id.widget_checks,R.id.widget_progress,R.id.widget_tasks,R.id.widget_calendar,R.id.widget_more})
            view.setViewVisibility(section,View.GONE);
        view.removeAllViews(R.id.widget_checks);view.removeAllViews(R.id.widget_tasks);view.removeAllViews(R.id.widget_calendar);
        view.setTextViewText(R.id.widget_message,message);
        view.setViewVisibility(R.id.widget_message,message.isEmpty()?View.GONE:View.VISIBLE);
        view.setOnClickPendingIntent(R.id.widget_message,open(context,"/profile/widgets",id));
        if(!fresh||!message.isEmpty())return view;
        JSONArray checks=snapshot.optJSONArray("checks"),events=snapshot.optJSONArray("events"),tasks=snapshot.optJSONArray("tasks");
        List<JSONObject> pending=new ArrayList<>();
        if(tasks!=null)for(int i=0;i<tasks.length();i++)if("pending".equals(tasks.getJSONObject(i).optString("state")))pending.add(tasks.getJSONObject(i));
        boolean large=height>=300;
        if(CALENDAR.equals(type)){
            view.setViewVisibility(R.id.widget_subtitle,View.VISIBLE);
            view.setTextViewText(R.id.widget_subtitle,today.substring(0,4)+"년 "+Integer.parseInt(today.substring(5,7))+"월");
            renderCalendar(context,view,snapshot,today,now);
            view.setViewVisibility(R.id.widget_tasks,View.VISIBLE);
            int count=events==null?0:Math.min(2,events.length());
            for(int i=0;i<count;i++)addEvent(context,view,R.id.widget_tasks,events.getJSONObject(i),id+i);
            if(count==0)addText(context,view,R.id.widget_tasks,"예정된 일정이 없어요","/calendar",id);
            if(!snapshot.has("calendarDates")){
                view.setViewVisibility(R.id.widget_tasks,View.GONE);
                showMore(context,view,"앱을 열어 일정을 새로고침해주세요","/profile/widgets",id);
            }
            return view;
        }
        if(COMBINED.equals(type)){
            view.setViewVisibility(R.id.widget_event,View.VISIBLE);
            JSONObject event=events!=null&&events.length()>0?events.getJSONObject(0):null;
            view.setTextViewText(R.id.widget_event,event==null?"예정된 일정이 없어요  ›":eventText(event));
            view.setOnClickPendingIntent(R.id.widget_event,open(context,event==null?"/calendar":event.optString("path","/calendar"),id));
        }
        if(DAILY.equals(type)||COMBINED.equals(type)){
            if(DAILY.equals(type)){
                int done=0; if(checks!=null)for(int i=0;i<checks.length();i++)if(checks.getJSONObject(i).optBoolean("checked"))done++;
                view.setViewVisibility(R.id.widget_subtitle,View.VISIBLE);
                view.setTextViewText(R.id.widget_subtitle,"오늘의 말씀과 기도  "+done+" / "+(checks==null?0:checks.length()));
            }
            view.setViewVisibility(R.id.widget_checks,View.VISIBLE);
            boolean stacked=DAILY.equals(type)&&large;
            view.setInt(R.id.widget_checks,"setOrientation",stacked?1:0);
            int count=checks==null?0:Math.min(3,checks.length());
            for(int i=0;i<count;i++){
                JSONObject check=checks.getJSONObject(i); boolean checked=check.optBoolean("checked");
                int layout=stacked?R.layout.newave_widget_row:DAILY.equals(type)?R.layout.newave_widget_daily_check:R.layout.newave_widget_check;
                RemoteViews row=new RemoteViews(context.getPackageName(),layout);
                row.setTextViewText(R.id.widget_row,(checked?"✓":"○")+(stacked?"   ":"\n")+check.optString("title"));
                row.setInt(R.id.widget_row,"setBackgroundResource",checked?R.drawable.widget_check_done:R.drawable.widget_check_background);
                row.setTextColor(R.id.widget_row,checked?0xffffffff:0xff246548);
                row.setContentDescription(R.id.widget_row,check.optString("title")+(checked?" 체크 완료, 누르면 해제":" 체크 안 함, 누르면 체크"));
                Uri identity=new Uri.Builder().scheme("newavewidget").authority("check").appendPath(String.valueOf(id))
                    .appendPath(session.optString("scope")).appendPath(today).appendPath(String.valueOf(check.getLong("id"))).appendPath(String.valueOf(!checked)).build();
                Intent action=new Intent(context,WidgetActionReceiver.class).setData(identity)
                    .putExtra("id",check.getLong("id")).putExtra("date",today).putExtra("scope",session.optString("scope"))
                    .putExtra("checked",!checked).putExtra("expected",checked);
                row.setOnClickPendingIntent(R.id.widget_row,PendingIntent.getBroadcast(context,0,action,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE));
                view.addView(R.id.widget_checks,row);
            }
            if(count==0)addText(context,view,R.id.widget_checks,"오늘 체크할 항목이 없어요","/tts",id);
            if(DAILY.equals(type)&&large&&checks!=null&&checks.length()>3)showMore(context,view,"전체 영성 체크  ›","/tts",id);
            if(COMBINED.equals(type)){
                RemoteViews remaining=new RemoteViews(context.getPackageName(),R.layout.newave_widget_check);
                remaining.setTextViewText(R.id.widget_row,"이번 주\n"+pending.size()+"개");
                remaining.setOnClickPendingIntent(R.id.widget_row,open(context,pending.isEmpty()?"/":pending.get(0).optString("path","/"),id));
                view.addView(R.id.widget_checks,remaining);
            }
        }
        if(WEEKLY.equals(type)||(COMBINED.equals(type)&&large)){
            view.setViewVisibility(R.id.widget_progress,View.VISIBLE);view.setViewVisibility(R.id.widget_tasks,View.VISIBLE);
            view.setTextViewText(R.id.widget_progress,"이번 주 남은 체크  "+pending.size()+"개");
            int available=Math.max(1,(height-(COMBINED.equals(type)?180:76))/52);
            int limit=Math.min(large?4:2,available);
            if(pending.size()>limit)limit=Math.max(0,limit-1); // Reserve a full touch target for overflow.
            for(int i=0;i<Math.min(limit,pending.size());i++)addText(context,view,R.id.widget_tasks,"○  "+pending.get(i).optString("title")+"  ›",pending.get(i).optString("path","/"),id+i);
            if(pending.isEmpty())addText(context,view,R.id.widget_tasks,"✓  남은 체크가 없어요","/",id);
            if(pending.size()>limit)showMore(context,view,"남은 "+(pending.size()-limit)+"개 더 보기  ›","/",id);
        }
        return view;
    }
    private static void showMore(Context c,RemoteViews view,String text,String path,int id){
        view.setViewVisibility(R.id.widget_more,View.VISIBLE);view.setTextViewText(R.id.widget_more,text);view.setOnClickPendingIntent(R.id.widget_more,open(c,path,id));
    }
    private static void addText(Context c,RemoteViews view,int container,String text,String path,int id){
        RemoteViews row=new RemoteViews(c.getPackageName(),R.layout.newave_widget_row);row.setTextViewText(R.id.widget_row,text);
        row.setOnClickPendingIntent(R.id.widget_row,open(c,path,id));view.addView(container,row);
    }
    private static String eventText(JSONObject event){return event.optString("date").substring(5).replace('-','.')+"  "+(event.optString("time").isEmpty()?"종일":event.optString("time"))+"\n"+event.optString("title");}
    private static void addEvent(Context c,RemoteViews view,int container,JSONObject event,int id){
        RemoteViews row=new RemoteViews(c.getPackageName(),R.layout.newave_widget_event);row.setTextViewText(R.id.widget_row,eventText(event));
        row.setOnClickPendingIntent(R.id.widget_row,open(c,event.optString("path","/calendar"),id));view.addView(container,row);
    }
    static int[] calendarShape(String date){
        Calendar cal=Calendar.getInstance(TimeZone.getTimeZone("Asia/Seoul"),Locale.ROOT);
        cal.clear();cal.set(Integer.parseInt(date.substring(0,4)),Integer.parseInt(date.substring(5,7))-1,1);
        return new int[]{cal.get(Calendar.DAY_OF_WEEK)-1,cal.getActualMaximum(Calendar.DAY_OF_MONTH)};
    }
    private static void renderCalendar(Context c,RemoteViews view,JSONObject snapshot,String today,Date now)throws Exception{
        int[] shape=calendarShape(today);int offset=shape[0],count=shape[1],rows=(offset+count+6)/7;
        Set<String> marked=new HashSet<>();JSONArray dates=snapshot.optJSONArray("calendarDates");
        if(dates!=null)for(int i=0;i<dates.length();i++)marked.add(dates.getString(i));
        view.setViewVisibility(R.id.widget_calendar,View.VISIBLE);
        view.setOnClickPendingIntent(R.id.widget_calendar,open(c,"/calendar?date="+today,0));
        for(int row=-1;row<rows;row++){
            RemoteViews week=new RemoteViews(c.getPackageName(),R.layout.newave_widget_week);
            for(int col=0;col<7;col++){
                RemoteViews cell=new RemoteViews(c.getPackageName(),R.layout.newave_widget_day);
                int day=row*7+col-offset+1;boolean valid=row>=0&&day>0&&day<=count;
                String key=today.substring(0,8)+String.format(Locale.ROOT,"%02d",day);
                String text=row==-1?new String[]{"일","월","화","수","목","금","토"}[col]:valid?String.valueOf(day):"";
                cell.setTextViewText(R.id.widget_day,text);
                cell.setViewVisibility(R.id.widget_dot,valid&&marked.contains(key)?View.VISIBLE:View.INVISIBLE);
                cell.setTextColor(R.id.widget_day,row==-1?0xff657993:today.equals(key)?0xffffffff:0xff17335a);
                if(valid&&today.equals(key))cell.setInt(R.id.widget_day,"setBackgroundResource",R.drawable.widget_today);
                week.addView(R.id.widget_week,cell);
            }
            view.addView(R.id.widget_calendar,week);
        }
    }
}
