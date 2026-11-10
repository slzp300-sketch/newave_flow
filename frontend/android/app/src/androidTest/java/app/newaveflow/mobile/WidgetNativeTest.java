package app.newaveflow.mobile;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;
import android.widget.FrameLayout;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.*;
import org.junit.runner.RunWith;
import org.json.*;
import java.util.*;
import java.text.SimpleDateFormat;
import java.io.FileOutputStream;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class WidgetNativeTest {
    Context context;
    @Before public void setup() throws Exception {
        context=InstrumentationRegistry.getInstrumentation().getTargetContext();
        Assume.assumeTrue("Never touch a real installation",context.getPackageName().endsWith(".widgetverification"));
        WidgetStore.clear(context);
    }
    @After public void cleanup() throws Exception { if(context.getPackageName().endsWith(".widgetverification"))WidgetStore.clear(context); }
    JSONObject fixture(long revision)throws Exception {
        SimpleDateFormat date=new SimpleDateFormat("yyyy-MM-dd",Locale.ROOT);date.setTimeZone(TimeZone.getTimeZone("Asia/Seoul"));
        return new JSONObject().put("token","synthetic-widget-only").put("scope","synthetic-account-a").put("baseURL","https://synthetic.up.railway.app/api")
            .put("snapshot",new JSONObject().put("schemaVersion",1).put("revision",revision).put("date",date.format(new Date()))
                .put("events",new JSONArray().put(new JSONObject().put("title","가상 주일 예배").put("date",date.format(new Date())).put("time","11:00").put("path","/calendar")))
                .put("checks",new JSONArray().put(new JSONObject().put("id",1).put("title","성경 읽기").put("checked",true))
                    .put(new JSONObject().put("id",2).put("title","개인 기도").put("checked",false)).put(new JSONObject().put("id",3).put("title","말씀 묵상").put("checked",false)))
                .put("tasks",new JSONArray().put(new JSONObject().put("id","prayer").put("title","기도모임 투표").put("state","pending").put("path","/meeting/prayer"))));
    }
    @Test public void encryptedStoreRejectsOtherAccountAndLateSnapshots()throws Exception{
        JSONObject first=fixture(1);WidgetStore.write(context,first);
        String stored=context.getSharedPreferences("newave_widget",Context.MODE_PRIVATE).getString("session","");
        assertFalse(stored.contains("synthetic-widget-only"));assertFalse(stored.contains("성경 읽기"));
        assertEquals(first.toString(),WidgetStore.read(context).toString());
        assertTrue(WidgetStore.replace(context,first.getString("token"),fixture(3).put("lastCheckAt","2026-11-09T09:30:00Z")));
        assertFalse(WidgetStore.replace(context,first.getString("token"),fixture(2)));
        assertTrue(WidgetStore.replace(context,first.getString("token"),fixture(4).put("lastCheckAt","2026-11-09T09:20:00Z")));
        assertEquals("2026-11-09T09:30:00Z",WidgetStore.read(context).getString("lastCheckAt"));
        WidgetStore.write(context,fixture(5).put("token","synthetic-b").put("scope","synthetic-account-b"));
        assertFalse(WidgetStore.replace(context,first.getString("token"),null));
        assertFalse(WidgetStore.replace(context,first.getString("token"),fixture(6)));
        assertEquals("synthetic-account-b",WidgetStore.read(context).getString("scope"));
        WidgetStore.clear(context);assertNull(WidgetStore.read(context));
    }
    @Test public void widgetInflatesAtSmallAndLargeSizesWithoutClipping()throws Exception{
        for(int height:new int[]{250,320,400}){
            var remote=NewaveWidgetProvider.buildViews(context,1,fixture(1),height,new Date());
            View view=remote.apply(context,new FrameLayout(context));
            float scale=context.getResources().getDisplayMetrics().density;
            int width=Math.round(320*scale),pixels=Math.round(height*scale);
            view.measure(View.MeasureSpec.makeMeasureSpec(width,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(pixels,View.MeasureSpec.EXACTLY));view.layout(0,0,width,pixels);
            assertEquals("NEWAVE  FLOW",((TextView)view.findViewById(R.id.widget_title)).getText().toString());
            assertEquals("이번 주  0 / 1",((TextView)view.findViewById(R.id.widget_progress)).getText().toString());
            assertChildrenFit((ViewGroup)view);
            if(height==320){Bitmap image=Bitmap.createBitmap(width,pixels,Bitmap.Config.ARGB_8888);view.draw(new Canvas(image));
                try(var output=new FileOutputStream(new java.io.File(context.getCacheDir(),"widget-layout.png"))){image.compress(Bitmap.CompressFormat.PNG,100,output);}image.recycle();}
        }
    }
    void assertChildrenFit(ViewGroup parent){for(int i=0;i<parent.getChildCount();i++){View child=parent.getChildAt(i);if(child.getVisibility()==View.GONE)continue;
        assertTrue("Widget child "+child.getId()+" bottom="+child.getBottom()+" parent="+parent.getHeight()+" fontScale="+context.getResources().getConfiguration().fontScale,child.getBottom()<=parent.getHeight());if(child instanceof ViewGroup)assertChildrenFit((ViewGroup)child);}}
    @Test public void endpointValidationAndOldAccountTapNeverReachNetwork()throws Exception{
        assertTrue(WidgetNetwork.validBase("https://synthetic.up.railway.app/api"));
        for(String base:new String[]{"http://a.up.railway.app/api","https://a.up.railway.app.evil.invalid/api","https://user@a.up.railway.app/api","https://a.up.railway.app/api?token=fake"})assertFalse(WidgetNetwork.validBase(base));
        WidgetStore.write(context,fixture(1));
        WidgetNetwork.fetch(context,new JSONObject().put("questionId",1),"different-account");
        assertFalse(WidgetStore.read(context).has("error"));assertEquals(1,WidgetStore.read(context).getJSONObject("snapshot").getLong("revision"));
    }
}
