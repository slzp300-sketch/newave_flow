package app.newaveflow.mobile;
import android.content.*;
import org.json.JSONObject;
import java.util.concurrent.*;
public class WidgetActionReceiver extends BroadcastReceiver {
    private static final java.util.Set<Long> busy=ConcurrentHashMap.newKeySet();
    @Override public void onReceive(Context context,Intent intent){
        long id=intent.getLongExtra("id",-1);if(id<1||!busy.add(id))return;
        PendingResult pending=goAsync();
        var executor=Executors.newSingleThreadExecutor();
        executor.execute(()->{try{
            JSONObject session=WidgetStore.read(context);
            if(session==null||!session.optString("scope").equals(intent.getStringExtra("scope")))return;
            JSONObject data=new JSONObject().put("questionId",id).put("date",intent.getStringExtra("date"))
                .put("checked",intent.getBooleanExtra("checked",false)).put("expectedChecked",intent.getBooleanExtra("expected",false));
            WidgetNetwork.fetch(context,data,intent.getStringExtra("scope"));
        }catch(Exception ignored){}finally{busy.remove(id);pending.finish();executor.shutdown();}});
    }
}
